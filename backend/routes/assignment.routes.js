const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { allocateParcel, allocateBatch, computeScore, WEIGHTS } = require('../algorithms/amfoa');
const { dijkstra } = require('../algorithms/graph');
const { knapsackSelect } = require('../algorithms/knapsack');
const { optimizeStopOrder } = require('../algorithms/tspDP');

router.use(authenticate);

async function loadGraph() {
  const edges = await pool.query('SELECT * FROM road_edges');
  const graph = {};
  edges.rows.forEach((e) => {
    graph[e.from_location] = graph[e.from_location] || [];
    graph[e.to_location] = graph[e.to_location] || [];
    graph[e.from_location].push({ to: e.to_location, weight: e.distance_km * e.traffic_factor });
    graph[e.to_location].push({ to: e.from_location, weight: e.distance_km * e.traffic_factor });
  });
  return graph;
}

// --- Allocate a single pending parcel via AMFOA ---
router.post('/allocate/:parcelId', requireRole('admin', 'fleet_manager'), async (req, res) => {
  try {
    const parcelRes = await pool.query('SELECT * FROM parcels WHERE id=$1', [req.params.parcelId]);
    if (!parcelRes.rows.length) return res.status(404).json({ error: 'Parcel not found' });
    const parcel = parcelRes.rows[0];

    const vehicles = (await pool.query('SELECT * FROM vehicles')).rows;
    const drivers = (await pool.query('SELECT * FROM drivers')).rows;
    const graph = await loadGraph();

    const result = allocateParcel(parcel, vehicles, drivers, graph);
    if (!result.success) return res.status(409).json(result);

    const chosen = result.chosen;
    const vehicle = vehicles.find((v) => v.id === chosen.vehicleId);

    await pool.query('BEGIN');
    await pool.query(
      `INSERT INTO assignments (parcel_id, vehicle_id, driver_id, optimization_score, score_breakdown)
       VALUES ($1,$2,$3,$4,$5)`,
      [parcel.id, chosen.vehicleId, vehicle.driver_id, chosen.score, JSON.stringify(chosen.breakdown)]
    );
    await pool.query('UPDATE parcels SET status=$1 WHERE id=$2', ['assigned', parcel.id]);
    await pool.query(
      `UPDATE vehicles SET current_load_kg = current_load_kg + $1, current_volume_m3 = current_volume_m3 + $2 WHERE id=$3`,
      [parcel.weight_kg, parcel.volume_m3, chosen.vehicleId]
    );
    await pool.query('COMMIT');

    res.json({ message: 'Parcel allocated via AMFOA', result });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Batch-allocate ALL pending parcels (priority-queue driven) ---
router.post('/allocate-batch', requireRole('admin', 'fleet_manager'), async (req, res) => {
  try {
    const parcels = (await pool.query("SELECT * FROM parcels WHERE status='pending'")).rows;
    const vehicles = (await pool.query('SELECT * FROM vehicles')).rows;
    const drivers = (await pool.query('SELECT * FROM drivers')).rows;
    const graph = await loadGraph();

    const results = allocateBatch(parcels, vehicles, drivers, graph);

    for (const r of results) {
      if (r.success) {
        const vehicle = vehicles.find((v) => v.id === r.chosen.vehicleId);
        await pool.query(
          `INSERT INTO assignments (parcel_id, vehicle_id, driver_id, optimization_score, score_breakdown)
           VALUES ($1,$2,$3,$4,$5)`,
          [r.parcel.id, r.chosen.vehicleId, vehicle.driver_id, r.chosen.score, JSON.stringify(r.chosen.breakdown)]
        );
        await pool.query('UPDATE parcels SET status=$1 WHERE id=$2', ['assigned', r.parcel.id]);
        await pool.query(
          `UPDATE vehicles SET current_load_kg = current_load_kg + $1, current_volume_m3 = current_volume_m3 + $2 WHERE id=$3`,
          [r.parcel.weight_kg, r.parcel.volume_m3, r.chosen.vehicleId]
        );
      }
    }

    res.json({ message: `Processed ${results.length} parcels`, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Knapsack: suggest the best subset of pending parcels for one vehicle's remaining capacity ---
router.post('/optimize-load/:vehicleId', requireRole('admin', 'fleet_manager'), async (req, res) => {
  try {
    const vehicleRes = await pool.query(`
      SELECT v.*, l.name AS location_name, u.name AS driver_name
      FROM vehicles v
      LEFT JOIN locations l ON l.id = v.current_location_id
      LEFT JOIN drivers d ON d.id = v.driver_id
      LEFT JOIN users u ON u.id = d.user_id
      WHERE v.id = $1
    `, [req.params.vehicleId]);

    if (!vehicleRes.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    const vehicle = vehicleRes.rows[0];

    // Fetch pending parcels joined with location names
    const pending = (await pool.query(`
      SELECT p.*, pl.name AS pickup_name, dl.name AS delivery_name
      FROM parcels p
      JOIN locations pl ON pl.id = p.pickup_location_id
      JOIN locations dl ON dl.id = p.delivery_location_id
      WHERE p.status = 'pending'
      ORDER BY p.deadline ASC
    `)).rows;

    const remainingWeight = Math.max(0, vehicle.max_weight_kg - vehicle.current_load_kg);
    const remainingVolume = Math.max(0, vehicle.max_volume_m3 - vehicle.current_volume_m3);
    const selected = knapsackSelect(pending, remainingWeight, remainingVolume);

    res.json({
      vehicle: vehicle.vehicle_number,
      vehicleId: vehicle.id,
      vehicleType: vehicle.type,
      locationName: vehicle.location_name,
      driverName: vehicle.driver_name,
      currentLoadKg: vehicle.current_load_kg,
      maxWeightKg: vehicle.max_weight_kg,
      currentVolumeM3: vehicle.current_volume_m3,
      maxVolumeM3: vehicle.max_volume_m3,
      remainingWeight,
      remainingVolume,
      totalWeight: selected.totalWeight || 0,
      totalVolume: selected.totalVolume || 0,
      totalValue: selected.totalValue || 0,
      weightUtilizationPct: selected.weightUtilization || 0,
      volumeUtilizationPct: selected.volumeUtilization || 0,
      remainingWeightAfter: Math.max(0, remainingWeight - (selected.totalWeight || 0)),
      remainingVolumeAfter: Math.max(0, Number((remainingVolume - (selected.totalVolume || 0)).toFixed(2))),
      suggestedParcels: selected,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- Apply Knapsack Package: batch-allocate all suggested parcels to the vehicle with 1 click ---
router.post('/apply-knapsack-load/:vehicleId', requireRole('admin', 'fleet_manager'), async (req, res) => {
  const { parcelIds } = req.body;
  if (!parcelIds || !Array.isArray(parcelIds) || parcelIds.length === 0) {
    return res.status(400).json({ error: 'parcelIds array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const vehicleRes = await client.query('SELECT * FROM vehicles WHERE id=$1 FOR UPDATE', [req.params.vehicleId]);
    if (!vehicleRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const vehicle = vehicleRes.rows[0];

    // Fetch the pending parcels
    const parcelsRes = await client.query(
      `SELECT * FROM parcels WHERE id = ANY($1::int[]) AND status = 'pending'`,
      [parcelIds]
    );

    if (parcelsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'None of the specified parcels are currently pending' });
    }

    const parcels = parcelsRes.rows;
    let addedWeight = 0;
    let addedVolume = 0;

    for (const p of parcels) {
      addedWeight += p.weight_kg;
      addedVolume += p.volume_m3;
    }

    const remW = vehicle.max_weight_kg - vehicle.current_load_kg;
    const remV = vehicle.max_volume_m3 - vehicle.current_volume_m3;

    if (addedWeight > remW + 1e-6 || addedVolume > remV + 1e-6) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Load exceeds vehicle capacity. Required: ${addedWeight.toFixed(1)}kg / ${addedVolume.toFixed(1)}m³, Available: ${remW.toFixed(1)}kg / ${remV.toFixed(1)}m³`
      });
    }

    const graph = await loadGraph();
    const drivers = (await client.query('SELECT * FROM drivers')).rows;

    for (const p of parcels) {
      const scoreObj = computeScore(vehicle, p, graph, drivers, { max: 40 });
      await client.query(
        `INSERT INTO assignments (parcel_id, vehicle_id, driver_id, optimization_score, score_breakdown)
         VALUES ($1,$2,$3,$4,$5)`,
        [p.id, vehicle.id, vehicle.driver_id, scoreObj.score, JSON.stringify(scoreObj.breakdown)]
      );
      await client.query("UPDATE parcels SET status = 'assigned' WHERE id = $1", [p.id]);
    }

    // Accumulate total load onto vehicle
    await client.query(
      `UPDATE vehicles 
       SET current_load_kg = current_load_kg + $1,
           current_volume_m3 = current_volume_m3 + $2
       WHERE id = $3`,
      [addedWeight, addedVolume, vehicle.id]
    );

    await client.query('COMMIT');
    res.json({
      message: `Successfully loaded ${parcels.length} parcel(s) onto ${vehicle.vehicle_number}`,
      allocatedCount: parcels.length,
      vehicleId: vehicle.id,
      addedWeight,
      addedVolume,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- Held-Karp DP: optimize multi-stop route order for a vehicle's active assignments ---
router.post('/optimize-route/:vehicleId', requireRole('admin', 'fleet_manager'), async (req, res) => {
  try {
    const vehicleId = req.params.vehicleId;
    const vehicleRes = await pool.query('SELECT * FROM vehicles WHERE id=$1', [vehicleId]);
    if (!vehicleRes.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    const vehicle = vehicleRes.rows[0];

    const assignedParcels = (await pool.query(
      `SELECT p.* FROM assignments a JOIN parcels p ON p.id = a.parcel_id
       WHERE a.vehicle_id=$1 AND a.status='assigned'`,
      [vehicleId]
    )).rows;
    if (!assignedParcels.length) return res.status(400).json({ error: 'No active parcels assigned to this vehicle' });

    const stops = [vehicle.current_location_id];
    assignedParcels.forEach((p) => { stops.push(p.pickup_location_id); stops.push(p.delivery_location_id); });
    const uniqueStops = [...new Set(stops)];

    const graph = await loadGraph();
    const optimized = optimizeStopOrder(graph, uniqueStops);

    await pool.query(
      `INSERT INTO routes (vehicle_id, stop_sequence, total_distance_km, estimated_time_min) VALUES ($1,$2,$3,$4)`,
      [vehicleId, JSON.stringify(optimized.orderedStops), optimized.totalDistanceKm, Number((optimized.totalDistanceKm * 2).toFixed(1))]
    );

    res.json({ message: 'Route optimized', ...optimized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assignments/parcel-breakdown/:parcelId - Detailed AMFOA Score Breakdown for a parcel across all vehicles
router.get('/parcel-breakdown/:parcelId', requireRole('admin', 'fleet_manager'), async (req, res) => {
  try {
    const parcelRes = await pool.query(`
      SELECT p.*, 
             pl.name AS pickup_name, pl.lat AS pickup_lat, pl.lng AS pickup_lng,
             dl.name AS delivery_name, dl.lat AS delivery_lat, dl.lng AS delivery_lng,
             a.id AS assignment_id, a.vehicle_id AS assigned_vehicle_id, 
             a.optimization_score, a.score_breakdown, a.assigned_at, a.status AS assignment_status,
             v.vehicle_number AS assigned_vehicle_number, v.type AS assigned_vehicle_type,
             du.name AS assigned_driver_name
      FROM parcels p
      JOIN locations pl ON pl.id = p.pickup_location_id
      JOIN locations dl ON dl.id = p.delivery_location_id
      LEFT JOIN assignments a ON a.parcel_id = p.id AND a.status != 'cancelled'
      LEFT JOIN vehicles v ON v.id = a.vehicle_id
      LEFT JOIN drivers d ON d.id = a.driver_id
      LEFT JOIN users du ON du.id = d.user_id
      WHERE p.id = $1
    `, [req.params.parcelId]);

    if (!parcelRes.rows.length) return res.status(404).json({ error: 'Parcel not found' });
    const parcel = parcelRes.rows[0];

    const vehicles = (await pool.query(`
      SELECT v.*, l.name AS location_name
      FROM vehicles v
      LEFT JOIN locations l ON l.id = v.current_location_id
      ORDER BY v.id
    `)).rows;

    const drivers = (await pool.query(`
      SELECT d.*, u.name, u.email
      FROM drivers d
      JOIN users u ON u.id = d.user_id
    `)).rows;

    const graph = await loadGraph();

    // Evaluate all candidate vehicles
    const candidateEvaluations = vehicles.map((v) => {
      const driver = drivers.find((d) => d.id === v.driver_id);
      const isCurrentlyAssigned = (parcel.assigned_vehicle_id === v.id);

      // Remaining capacity
      const remW = v.max_weight_kg - (isCurrentlyAssigned ? Math.max(0, v.current_load_kg - parcel.weight_kg) : v.current_load_kg);
      const remV = v.max_volume_m3 - (isCurrentlyAssigned ? Math.max(0, v.current_volume_m3 - parcel.volume_m3) : v.current_volume_m3);

      let eligible = true;
      let reasons = [];

      if (v.status !== 'available' && !isCurrentlyAssigned) {
        eligible = false;
        reasons.push(`Vehicle is ${v.status}`);
      }
      if (remW < parcel.weight_kg && !isCurrentlyAssigned) {
        eligible = false;
        reasons.push(`Weight cap exceeded (Needs ${parcel.weight_kg}kg, free ${remW.toFixed(0)}kg)`);
      }
      if (remV < parcel.volume_m3 && !isCurrentlyAssigned) {
        eligible = false;
        reasons.push(`Volume cap exceeded (Needs ${parcel.volume_m3}m³, free ${remV.toFixed(1)}m³)`);
      }
      if (!driver) {
        eligible = false;
        reasons.push('No driver assigned');
      } else {
        if (!driver.availability && !isCurrentlyAssigned) {
          eligible = false;
          reasons.push('Driver currently unavailable');
        }
        if (driver.working_hours_today >= driver.max_working_hours && !isCurrentlyAssigned) {
          eligible = false;
          reasons.push('Driver exceeded max working hours');
        }
      }

      // Compute score
      const distResult = dijkstra(graph, v.current_location_id, parcel.pickup_location_id);
      const distance = distResult.distance === Infinity ? 999 : distResult.distance;
      const scoreObj = computeScore(v, parcel, graph, drivers, { max: 40 });

      return {
        vehicleId: v.id,
        vehicleNumber: v.vehicle_number,
        vehicleType: v.type,
        locationName: v.location_name,
        currentLoadKg: v.current_load_kg,
        maxWeightKg: v.max_weight_kg,
        currentVolumeM3: v.current_volume_m3,
        maxVolumeM3: v.max_volume_m3,
        fuelEfficiencyKmpl: v.fuel_efficiency_kmpl,
        maintenanceScore: v.maintenance_score,
        status: v.status,
        driverName: driver ? driver.name : 'Unassigned',
        driverHoursToday: driver ? driver.working_hours_today : 0,
        driverMaxHours: driver ? driver.max_working_hours : 8,
        eligible,
        disqualificationReason: reasons.join(', ') || null,
        score: scoreObj.score,
        breakdown: scoreObj.breakdown,
        isCurrentlyAssigned
      };
    });

    // Sort: assigned first, then eligible by score descending, then ineligible
    candidateEvaluations.sort((a, b) => {
      if (a.isCurrentlyAssigned) return -1;
      if (b.isCurrentlyAssigned) return 1;
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      return b.score - a.score;
    });

    res.json({
      parcel,
      weights: WEIGHTS,
      candidateEvaluations,
      recordedBreakdown: parcel.score_breakdown
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const result = await pool.query(`
    SELECT a.*, 
           p.pickup_location_id, p.delivery_location_id, p.weight_kg, p.volume_m3, p.priority,
           pl.name AS pickup_name, dl.name AS delivery_name,
           v.vehicle_number, v.type AS vehicle_type,
           u.name AS driver_name
    FROM assignments a
    JOIN parcels p ON p.id = a.parcel_id
    JOIN locations pl ON pl.id = p.pickup_location_id
    JOIN locations dl ON dl.id = p.delivery_location_id
    JOIN vehicles v ON v.id = a.vehicle_id
    LEFT JOIN drivers d ON d.id = a.driver_id
    LEFT JOIN users u ON u.id = d.user_id
    ORDER BY a.assigned_at DESC
  `);
  res.json(result.rows);
});

// Driver: get my active deliveries
router.get('/my-deliveries', requireRole('driver'), async (req, res) => {
  const driverRes = await pool.query('SELECT id FROM drivers WHERE user_id=$1', [req.user.id]);
  if (!driverRes.rows.length) return res.json([]);
  const driverId = driverRes.rows[0].id;
  const result = await pool.query(`
    SELECT a.id AS assignment_id, a.status AS assignment_status, a.optimization_score,
           p.id AS parcel_id, p.weight_kg, p.volume_m3, p.priority, p.deadline, p.fragile, p.special_instructions,
           pl.name AS pickup_name, dl.name AS delivery_name
    FROM assignments a
    JOIN parcels p ON p.id = a.parcel_id
    JOIN locations pl ON pl.id = p.pickup_location_id
    JOIN locations dl ON dl.id = p.delivery_location_id
    WHERE a.driver_id = $1 AND a.status != 'completed'
    ORDER BY p.deadline ASC
  `, [driverId]);
  res.json(result.rows);
});

router.put('/:id/complete', requireRole('driver'), async (req, res) => {
  await pool.query('BEGIN');
  const a = await pool.query("UPDATE assignments SET status='completed', delivered_at=NOW() WHERE id=$1 RETURNING *", [req.params.id]);
  if (a.rows.length) {
    await pool.query('UPDATE parcels SET status=$1 WHERE id=$2', ['delivered', a.rows[0].parcel_id]);
    // Free up vehicle load
    const parcelRes = await pool.query('SELECT weight_kg, volume_m3 FROM parcels WHERE id=$1', [a.rows[0].parcel_id]);
    if (parcelRes.rows.length) {
      await pool.query(
        `UPDATE vehicles 
         SET current_load_kg = GREATEST(0, current_load_kg - $1),
             current_volume_m3 = GREATEST(0, current_volume_m3 - $2)
         WHERE id = $3`,
        [parcelRes.rows[0].weight_kg, parcelRes.rows[0].volume_m3, a.rows[0].vehicle_id]
      );
    }
  }
  await pool.query('COMMIT');
  res.json(a.rows[0]);
});

module.exports = router;
