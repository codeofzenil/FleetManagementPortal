const router = require('express').Router();
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Get all locations for dropdowns and mapping
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locations ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Get road network edges
router.get('/edges', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, fl.name AS from_name, tl.name AS to_name
      FROM road_edges e
      JOIN locations fl ON fl.id = e.from_location
      JOIN locations tl ON tl.id = e.to_location
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch road edges' });
  }
});

module.exports = router;
