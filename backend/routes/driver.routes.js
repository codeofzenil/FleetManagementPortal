const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/drivers - List all drivers with user account & assigned vehicle info
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        d.id, d.user_id, d.license_no, d.experience_years, 
        d.working_hours_today, d.max_working_hours, d.availability, d.rating,
        d.assigned_vehicle_id,
        u.name, u.email, u.created_at AS user_created_at,
        v.vehicle_number, v.type AS vehicle_type, v.status AS vehicle_status
      FROM drivers d 
      JOIN users u ON u.id = d.user_id 
      LEFT JOIN vehicles v ON v.id = d.assigned_vehicle_id
      ORDER BY d.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// POST /api/drivers - Add new driver along with login credentials
router.post('/', requireRole('admin', 'fleet_manager'), async (req, res) => {
  const { name, email, password, license_no, experience_years, max_working_hours, assigned_vehicle_id, availability, rating } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check duplicate email
    const dup = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (dup.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'driver') RETURNING id, name, email, role`,
      [name, email, hash]
    );
    const userId = userRes.rows[0].id;

    const driverRes = await client.query(
      `INSERT INTO drivers (user_id, license_no, experience_years, max_working_hours, assigned_vehicle_id, availability, rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        userId,
        license_no || ('DL-' + Math.floor(10000 + Math.random() * 90000)),
        Number(experience_years) || 1,
        Number(max_working_hours) || 8,
        assigned_vehicle_id ? Number(assigned_vehicle_id) : null,
        availability !== undefined ? availability : true,
        Number(rating) || 5.0
      ]
    );
    const driver = driverRes.rows[0];

    // If a vehicle was selected, link it
    if (assigned_vehicle_id) {
      await client.query('UPDATE vehicles SET driver_id = $1 WHERE id = $2', [driver.id, assigned_vehicle_id]);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Driver created successfully', driver: { ...driver, name, email } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create driver' });
  } finally {
    client.release();
  }
});

// PUT /api/drivers/:id - Update driver and login account details
router.put('/:id', requireRole('admin', 'fleet_manager', 'driver'), async (req, res) => {
  const { 
    name, email, password, license_no, experience_years, 
    working_hours_today, max_working_hours, availability, rating, assigned_vehicle_id 
  } = req.body;
  const driverId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currDriver = await client.query('SELECT * FROM drivers WHERE id = $1', [driverId]);
    if (currDriver.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Driver not found' });
    }
    const driver = currDriver.rows[0];

    // Update user details if provided
    if (name || email || password) {
      if (email) {
        const dup = await client.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, driver.user_id]);
        if (dup.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Email already used by another account' });
        }
      }

      if (password && password.trim()) {
        const hash = await bcrypt.hash(password, 10);
        await client.query(
          'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), password_hash = $3 WHERE id = $4',
          [name || null, email || null, hash, driver.user_id]
        );
      } else {
        await client.query(
          'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3',
          [name || null, email || null, driver.user_id]
        );
      }
    }

    // Update driver details
    const updatedDriver = await client.query(
      `UPDATE drivers SET 
        license_no = COALESCE($1, license_no),
        experience_years = COALESCE($2, experience_years),
        working_hours_today = COALESCE($3, working_hours_today),
        max_working_hours = COALESCE($4, max_working_hours),
        availability = COALESCE($5, availability),
        rating = COALESCE($6, rating),
        assigned_vehicle_id = $7
       WHERE id = $8 RETURNING *`,
      [
        license_no !== undefined ? license_no : null,
        experience_years !== undefined ? Number(experience_years) : null,
        working_hours_today !== undefined ? Number(working_hours_today) : null,
        max_working_hours !== undefined ? Number(max_working_hours) : null,
        availability !== undefined ? availability : null,
        rating !== undefined ? Number(rating) : null,
        assigned_vehicle_id !== undefined ? (assigned_vehicle_id ? Number(assigned_vehicle_id) : null) : driver.assigned_vehicle_id,
        driverId
      ]
    );

    // Synchronize vehicle assignment
    const newVehId = assigned_vehicle_id !== undefined ? (assigned_vehicle_id ? Number(assigned_vehicle_id) : null) : driver.assigned_vehicle_id;
    if (newVehId !== driver.assigned_vehicle_id) {
      if (driver.assigned_vehicle_id) {
        await client.query('UPDATE vehicles SET driver_id = NULL WHERE id = $1 AND driver_id = $2', [driver.assigned_vehicle_id, driverId]);
      }
      if (newVehId) {
        await client.query('UPDATE vehicles SET driver_id = $1 WHERE id = $2', [driverId, newVehId]);
      }
    }

    await client.query('COMMIT');

    const result = await pool.query(`
      SELECT 
        d.id, d.user_id, d.license_no, d.experience_years, 
        d.working_hours_today, d.max_working_hours, d.availability, d.rating,
        d.assigned_vehicle_id,
        u.name, u.email,
        v.vehicle_number, v.type AS vehicle_type
      FROM drivers d 
      JOIN users u ON u.id = d.user_id 
      LEFT JOIN vehicles v ON v.id = d.assigned_vehicle_id
      WHERE d.id = $1
    `, [driverId]);

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update driver' });
  } finally {
    client.release();
  }
});

// DELETE /api/drivers/:id - Remove driver and linked user account
router.delete('/:id', requireRole('admin', 'fleet_manager'), async (req, res) => {
  const driverId = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currDriver = await client.query('SELECT * FROM drivers WHERE id = $1', [driverId]);
    if (currDriver.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Driver not found' });
    }
    const userId = currDriver.rows[0].user_id;

    // Unassign vehicle referencing this driver
    await client.query('UPDATE vehicles SET driver_id = NULL WHERE driver_id = $1', [driverId]);
    // Clear driver_id in assignments
    await client.query('UPDATE assignments SET driver_id = NULL WHERE driver_id = $1', [driverId]);

    // Delete driver record
    await client.query('DELETE FROM drivers WHERE id = $1', [driverId]);
    // Delete user account
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');
    res.json({ message: 'Driver and login removed successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to delete driver' });
  } finally {
    client.release();
  }
});

module.exports = router;
