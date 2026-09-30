const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { mergeSort, byDeadline } = require('../algorithms/mergeSort');

router.use(authenticate);

// GET /api/parcels - Fetch all parcels with locations, assigned vehicle/driver, and optimization score
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*, 
        pl.name AS pickup_name, pl.lat AS pickup_lat, pl.lng AS pickup_lng,
        dl.name AS delivery_name, dl.lat AS delivery_lat, dl.lng AS delivery_lng,
        cu_u.name AS customer_name,
        a.id AS assignment_id, a.vehicle_id, a.optimization_score, a.score_breakdown,
        v.vehicle_number, v.type AS vehicle_type,
        du.name AS driver_name
      FROM parcels p
      JOIN locations pl ON pl.id = p.pickup_location_id
      JOIN locations dl ON dl.id = p.delivery_location_id
      LEFT JOIN customers c ON c.id = p.customer_id
      LEFT JOIN users cu_u ON cu_u.id = c.user_id
      LEFT JOIN assignments a ON a.parcel_id = p.id AND a.status != 'cancelled'
      LEFT JOIN vehicles v ON v.id = a.vehicle_id
      LEFT JOIN drivers d ON d.id = a.driver_id
      LEFT JOIN users du ON du.id = d.user_id
      ORDER BY p.created_at DESC
    `);
    // Stable O(n log n) sorting by deadline using mergeSort
    res.json(mergeSort(result.rows, byDeadline));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch parcels' });
  }
});

// POST /api/parcels - Create new parcel (Admin & Fleet Manager)
router.post('/', requireRole('admin', 'fleet_manager'), async (req, res) => {
  let { 
    customer_id, pickup_location_id, delivery_location_id, 
    weight_kg, volume_m3, priority, fragile, deadline, special_instructions 
  } = req.body;

  try {
    if (!pickup_location_id || !delivery_location_id || !weight_kg || !volume_m3 || !deadline) {
      return res.status(400).json({ error: 'Pickup, delivery, weight, volume, and deadline are required' });
    }

    // Default to first customer if none specified
    if (!customer_id) {
      const custRes = await pool.query('SELECT id FROM customers LIMIT 1');
      if (custRes.rows.length) {
        customer_id = custRes.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO parcels (
        customer_id, pickup_location_id, delivery_location_id, 
        weight_kg, volume_m3, priority, fragile, deadline, special_instructions, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') RETURNING *`,
      [
        customer_id || null, 
        Number(pickup_location_id), 
        Number(delivery_location_id), 
        Number(weight_kg), 
        Number(volume_m3), 
        Number(priority) || 3, 
        fragile === true || fragile === 'true', 
        deadline, 
        special_instructions || null
      ]
    );

    // Fetch complete parcel with location names
    const full = await pool.query(`
      SELECT p.*, pl.name AS pickup_name, dl.name AS delivery_name
      FROM parcels p
      JOIN locations pl ON pl.id = p.pickup_location_id
      JOIN locations dl ON dl.id = p.delivery_location_id
      WHERE p.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(full.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create parcel' });
  }
});

// PUT /api/parcels/:id - Edit parcel details (Admin & Fleet Manager)
router.put('/:id', requireRole('admin', 'fleet_manager'), async (req, res) => {
  const parcelId = req.params.id;
  const { 
    pickup_location_id, delivery_location_id, 
    weight_kg, volume_m3, priority, fragile, deadline, special_instructions, status 
  } = req.body;

  try {
    const curr = await pool.query('SELECT * FROM parcels WHERE id = $1', [parcelId]);
    if (!curr.rows.length) return res.status(404).json({ error: 'Parcel not found' });
    const old = curr.rows[0];

    const result = await pool.query(
      `UPDATE parcels SET
        pickup_location_id = COALESCE($1, pickup_location_id),
        delivery_location_id = COALESCE($2, delivery_location_id),
        weight_kg = COALESCE($3, weight_kg),
        volume_m3 = COALESCE($4, volume_m3),
        priority = COALESCE($5, priority),
        fragile = COALESCE($6, fragile),
        deadline = COALESCE($7, deadline),
        special_instructions = COALESCE($8, special_instructions),
        status = COALESCE($9, status)
       WHERE id = $10 RETURNING *`,
      [
        pickup_location_id ? Number(pickup_location_id) : null,
        delivery_location_id ? Number(delivery_location_id) : null,
        weight_kg !== undefined ? Number(weight_kg) : null,
        volume_m3 !== undefined ? Number(volume_m3) : null,
        priority !== undefined ? Number(priority) : null,
        fragile !== undefined ? (fragile === true || fragile === 'true') : null,
        deadline || null,
        special_instructions !== undefined ? special_instructions : null,
        status || null,
        parcelId
      ]
    );

    const full = await pool.query(`
      SELECT p.*, pl.name AS pickup_name, dl.name AS delivery_name
      FROM parcels p
      JOIN locations pl ON pl.id = p.pickup_location_id
      JOIN locations dl ON dl.id = p.delivery_location_id
      WHERE p.id = $1
    `, [parcelId]);

    res.json(full.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update parcel' });
  }
});

// PUT /api/parcels/:id/status - Quick status update
router.put('/:id/status', requireRole('admin', 'fleet_manager', 'driver'), async (req, res) => {
  const { status } = req.body;
  try {
    const result = await pool.query('UPDATE parcels SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Parcel not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/parcels/:id - Remove parcel (Admin & Fleet Manager)
router.delete('/:id', requireRole('admin', 'fleet_manager'), async (req, res) => {
  const parcelId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const curr = await client.query('SELECT * FROM parcels WHERE id = $1', [parcelId]);
    if (!curr.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Parcel not found' });
    }
    const parcel = curr.rows[0];

    // If parcel was assigned, decrease load on the assigned vehicle
    const assignment = await client.query('SELECT * FROM assignments WHERE parcel_id = $1', [parcelId]);
    if (assignment.rows.length && parcel.status === 'assigned') {
      const vehId = assignment.rows[0].vehicle_id;
      await client.query(
        `UPDATE vehicles 
         SET current_load_kg = GREATEST(0, current_load_kg - $1),
             current_volume_m3 = GREATEST(0, current_volume_m3 - $2)
         WHERE id = $3`,
        [parcel.weight_kg, parcel.volume_m3, vehId]
      );
    }

    // Delete assignments for parcel
    await client.query('DELETE FROM assignments WHERE parcel_id = $1', [parcelId]);
    // Delete parcel
    await client.query('DELETE FROM parcels WHERE id = $1', [parcelId]);

    await client.query('COMMIT');
    res.json({ message: 'Parcel removed successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to delete parcel' });
  } finally {
    client.release();
  }
});

module.exports = router;
