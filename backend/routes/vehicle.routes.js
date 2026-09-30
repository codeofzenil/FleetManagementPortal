const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/vehicles - List all vehicles with location and driver info
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        v.*, 
        l.lat, l.lng, l.name AS location_name,
        d.license_no, d.working_hours_today, d.max_working_hours, d.availability AS driver_availability, d.rating AS driver_rating,
        u.name AS driver_name, u.email AS driver_email,
        (SELECT COUNT(*) FROM assignments a WHERE a.vehicle_id = v.id AND a.status = 'assigned') AS active_assignments_count
      FROM vehicles v 
      LEFT JOIN locations l ON l.id = v.current_location_id
      LEFT JOIN drivers d ON d.id = v.driver_id
      LEFT JOIN users u ON u.id = d.user_id
      ORDER BY v.id ASC
    `);

    // Compute live operational readiness score (0-100) for each vehicle
    const vehiclesWithScores = result.rows.map((v) => {
      const loadCapacityPct = Math.max(0, Math.min(100, Math.round(((v.max_weight_kg - v.current_load_kg) / v.max_weight_kg) * 100)));
      const maintenanceScore = v.maintenance_score || 100;
      const driverHoursLeft = v.driver_id ? Math.max(0, (v.max_working_hours || 8) - (v.working_hours_today || 0)) : 0;
      const driverScore = v.driver_id && v.driver_availability ? Math.round((driverHoursLeft / (v.max_working_hours || 8)) * 100) : 0;
      const fuelScore = Math.min(100, Math.round(((v.fuel_efficiency_kmpl || 10) / 20) * 100));

      const readinessIndex = Math.round(
        maintenanceScore * 0.35 +
        loadCapacityPct * 0.30 +
        driverScore * 0.20 +
        fuelScore * 0.15
      );

      return {
        ...v,
        readiness_index: readinessIndex,
        load_percentage: Math.round((v.current_load_kg / v.max_weight_kg) * 100),
        volume_percentage: Math.round((v.current_volume_m3 / v.max_volume_m3) * 100)
      };
    });

    res.json(vehiclesWithScores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// GET /api/vehicles/:id/score-breakdown - Detailed AMFOA vehicle metrics & score breakdown
router.get('/:id/score-breakdown', requireRole('admin', 'fleet_manager'), async (req, res) => {
  const vehicleId = req.params.id;
  try {
    const vehRes = await pool.query(`
      SELECT 
        v.*, 
        l.lat, l.lng, l.name AS location_name,
        d.id AS driver_table_id, d.license_no, d.working_hours_today, d.max_working_hours, 
        d.availability AS driver_availability, d.rating AS driver_rating,
        u.name AS driver_name, u.email AS driver_email
      FROM vehicles v 
      LEFT JOIN locations l ON l.id = v.current_location_id
      LEFT JOIN drivers d ON d.id = v.driver_id
      LEFT JOIN users u ON u.id = d.user_id
      WHERE v.id = $1
    `, [vehicleId]);

    if (!vehRes.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    const v = vehRes.rows[0];

    // Fetch active assignments & parcels loaded
    const activeAssignments = (await pool.query(`
      SELECT a.id, a.optimization_score, a.score_breakdown, a.assigned_at, a.status,
             p.id AS parcel_id, p.weight_kg, p.volume_m3, p.priority, p.deadline, p.fragile,
             pl.name AS pickup_name, dl.name AS delivery_name
      FROM assignments a
      JOIN parcels p ON p.id = a.parcel_id
      JOIN locations pl ON pl.id = p.pickup_location_id
      JOIN locations dl ON dl.id = p.delivery_location_id
      WHERE a.vehicle_id = $1 AND a.status = 'assigned'
    `, [vehicleId])).rows;

    // Fetch historical deliveries stats
    const historyRes = await pool.query(`
      SELECT 
        COUNT(*) AS total_delivered,
        AVG(optimization_score) AS avg_score,
        MIN(optimization_score) AS min_score,
        MAX(optimization_score) AS max_score
      FROM assignments 
      WHERE vehicle_id = $1 AND status = 'completed'
    `, [vehicleId]);

    const loadCapacityRatio = Math.max(0, 1 - (v.current_load_kg / v.max_weight_kg));
    const volumeCapacityRatio = Math.max(0, 1 - (v.current_volume_m3 / v.max_volume_m3));
    const maintenanceRatio = (v.maintenance_score ?? 100) / 100;
    const fuelEfficiencyRating = Math.min(1.0, (v.fuel_efficiency_kmpl || 10) / 25);
    
    let driverHoursRatio = 0;
    if (v.driver_id && v.driver_availability) {
      const hoursLeft = Math.max(0, (v.max_working_hours || 8) - (v.working_hours_today || 0));
      driverHoursRatio = hoursLeft / (v.max_working_hours || 8);
    }

    const readinessIndex = Math.round(
      (maintenanceRatio * 0.35 +
       loadCapacityRatio * 0.30 +
       driverHoursRatio * 0.20 +
       fuelEfficiencyRating * 0.15) * 100
    );

    res.json({
      vehicle: v,
      readinessIndex,
      factors: {
        maintenanceScore: {
          value: v.maintenance_score ?? 100,
          weightPct: 35,
          label: 'Vehicle Health & Maintenance',
          status: (v.maintenance_score ?? 100) >= 80 ? 'Optimal' : (v.maintenance_score ?? 100) >= 50 ? 'Fair' : 'Requires Service'
        },
        capacityAvailability: {
          value: Math.round(loadCapacityRatio * 100),
          weightPct: 30,
          label: 'Weight Capacity Available',
          usedKg: v.current_load_kg,
          maxKg: v.max_weight_kg,
          freeKg: Math.max(0, v.max_weight_kg - v.current_load_kg),
          volumePct: Math.round(volumeCapacityRatio * 100),
          usedM3: v.current_volume_m3,
          maxM3: v.max_volume_m3
        },
        driverReadiness: {
          value: Math.round(driverHoursRatio * 100),
          weightPct: 20,
          label: 'Driver Hours & Availability',
          driverName: v.driver_name || 'No driver assigned',
          hoursRemaining: v.driver_id ? Math.max(0, (v.max_working_hours || 8) - (v.working_hours_today || 0)).toFixed(1) : 0,
          maxHours: v.max_working_hours || 8,
          isAvailable: Boolean(v.driver_availability)
        },
        fuelEfficiency: {
          value: Math.round(fuelEfficiencyRating * 100),
          weightPct: 15,
          label: 'Fuel Economy & Emissions Index',
          kmpl: v.fuel_efficiency_kmpl,
          fuelType: v.fuel_type
        }
      },
      activeAssignments,
      history: {
        totalDelivered: Number(historyRes.rows[0].total_delivered || 0),
        avgScore: Number(historyRes.rows[0].avg_score ? Number(historyRes.rows[0].avg_score).toFixed(3) : 0),
        minScore: Number(historyRes.rows[0].min_score ? Number(historyRes.rows[0].min_score).toFixed(3) : 0),
        maxScore: Number(historyRes.rows[0].max_score ? Number(historyRes.rows[0].max_score).toFixed(3) : 0)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch vehicle score breakdown' });
  }
});

// POST /api/vehicles - Create new vehicle
router.post('/', requireRole('admin', 'fleet_manager'), async (req, res) => {
  const { vehicle_number, type, max_weight_kg, max_volume_m3, fuel_type, fuel_efficiency_kmpl, current_location_id, driver_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO vehicles (vehicle_number, type, max_weight_kg, max_volume_m3, fuel_type, fuel_efficiency_kmpl, current_location_id, driver_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        vehicle_number, 
        type || 'Mini Truck', 
        Number(max_weight_kg), 
        Number(max_volume_m3), 
        fuel_type || 'diesel', 
        Number(fuel_efficiency_kmpl) || 12, 
        Number(current_location_id) || 1,
        driver_id ? Number(driver_id) : null
      ]
    );

    if (driver_id) {
      await pool.query('UPDATE drivers SET assigned_vehicle_id = $1 WHERE id = $2', [result.rows[0].id, driver_id]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/vehicles/:id - Update vehicle
router.put('/:id', requireRole('admin', 'fleet_manager'), async (req, res) => {
  const { status, maintenance_score, driver_id, current_location_id, fuel_efficiency_kmpl, max_weight_kg, max_volume_m3, type } = req.body;
  try {
    const curr = await pool.query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
    if (!curr.rows.length) return res.status(404).json({ error: 'Vehicle not found' });
    const oldVeh = curr.rows[0];

    const result = await pool.query(
      `UPDATE vehicles SET 
        status = COALESCE($1, status), 
        maintenance_score = COALESCE($2, maintenance_score),
        driver_id = $3,
        current_location_id = COALESCE($4, current_location_id),
        fuel_efficiency_kmpl = COALESCE($5, fuel_efficiency_kmpl),
        max_weight_kg = COALESCE($6, max_weight_kg),
        max_volume_m3 = COALESCE($7, max_volume_m3),
        type = COALESCE($8, type)
       WHERE id = $9 RETURNING *`,
      [
        status || null, 
        maintenance_score !== undefined ? Number(maintenance_score) : null, 
        driver_id !== undefined ? (driver_id ? Number(driver_id) : null) : oldVeh.driver_id,
        current_location_id ? Number(current_location_id) : null,
        fuel_efficiency_kmpl ? Number(fuel_efficiency_kmpl) : null,
        max_weight_kg ? Number(max_weight_kg) : null,
        max_volume_m3 ? Number(max_volume_m3) : null,
        type || null,
        req.params.id
      ]
    );

    // Sync driver table
    const newDriverId = driver_id !== undefined ? (driver_id ? Number(driver_id) : null) : oldVeh.driver_id;
    if (newDriverId !== oldVeh.driver_id) {
      if (oldVeh.driver_id) {
        await pool.query('UPDATE drivers SET assigned_vehicle_id = NULL WHERE id = $1', [oldVeh.driver_id]);
      }
      if (newDriverId) {
        await pool.query('UPDATE drivers SET assigned_vehicle_id = $1 WHERE id = $2', [req.params.id, newDriverId]);
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/vehicles/:id - Remove vehicle
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE drivers SET assigned_vehicle_id = NULL WHERE assigned_vehicle_id = $1', [req.params.id]);
    await pool.query('DELETE FROM routes WHERE vehicle_id = $1', [req.params.id]);
    await pool.query('DELETE FROM fuel_logs WHERE vehicle_id = $1', [req.params.id]);
    await pool.query('DELETE FROM maintenance WHERE vehicle_id = $1', [req.params.id]);
    await pool.query('DELETE FROM assignments WHERE vehicle_id = $1', [req.params.id]);
    await pool.query('DELETE FROM vehicles WHERE id = $1', [req.params.id]);
    res.json({ message: 'Vehicle removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
