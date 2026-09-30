const router = require('express').Router();
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/summary', async (req, res) => {
  try {
    const [
      vehiclesStatus,
      parcelsStatus,
      deliveriesToday,
      fuelToday,
      driversSummary,
      capacitySummary,
      prioritySummary,
      recentAssignments
    ] = await Promise.all([
      pool.query('SELECT status, COUNT(*)::int AS count FROM vehicles GROUP BY status'),
      pool.query('SELECT status, COUNT(*)::int AS count FROM parcels GROUP BY status'),
      pool.query("SELECT COUNT(*)::int AS count FROM assignments WHERE status='completed'"),
      pool.query("SELECT COALESCE(SUM(liters_used), 0)::numeric AS total FROM fuel_logs"),
      pool.query(`
        SELECT 
          COUNT(*)::int AS total_drivers,
          COUNT(CASE WHEN availability = true THEN 1 END)::int AS available_drivers,
          COUNT(CASE WHEN assigned_vehicle_id IS NOT NULL THEN 1 END)::int AS assigned_drivers,
          ROUND(AVG(rating)::numeric, 1) AS avg_rating
        FROM drivers
      `),
      pool.query(`
        SELECT 
          SUM(max_weight_kg)::numeric AS total_max_weight,
          SUM(current_load_kg)::numeric AS total_current_load,
          SUM(max_volume_m3)::numeric AS total_max_volume,
          SUM(current_volume_m3)::numeric AS total_current_volume
        FROM vehicles
      `),
      pool.query(`
        SELECT priority, COUNT(*)::int AS count
        FROM parcels
        GROUP BY priority
        ORDER BY priority ASC
      `),
      pool.query(`
        SELECT a.id, a.optimization_score, a.assigned_at, a.status,
               p.weight_kg, p.priority,
               pl.name AS pickup_name, dl.name AS delivery_name,
               v.vehicle_number, u.name AS driver_name
        FROM assignments a
        JOIN parcels p ON p.id = a.parcel_id
        JOIN locations pl ON pl.id = p.pickup_location_id
        JOIN locations dl ON dl.id = p.delivery_location_id
        JOIN vehicles v ON v.id = a.vehicle_id
        LEFT JOIN drivers d ON d.id = a.driver_id
        LEFT JOIN users u ON u.id = d.user_id
        ORDER BY a.assigned_at DESC
        LIMIT 6
      `)
    ]);

    const cap = capacitySummary.rows[0];
    const totalMaxW = Number(cap.total_max_weight || 0);
    const totalCurW = Number(cap.total_current_load || 0);
    const weightUtilPct = totalMaxW > 0 ? Math.round((totalCurW / totalMaxW) * 100) : 0;

    res.json({
      vehicles: vehiclesStatus.rows,
      parcels: parcelsStatus.rows,
      completedToday: Number(deliveriesToday.rows[0]?.count || 0),
      fuelToday: Number(fuelToday.rows[0]?.total || 0),
      drivers: driversSummary.rows[0] || {},
      capacity: {
        totalMaxWeightKg: totalMaxW,
        totalCurrentLoadKg: totalCurW,
        weightUtilizationPct: weightUtilPct,
        totalMaxVolumeM3: Number(cap.total_max_volume || 0),
        totalCurrentVolumeM3: Number(cap.total_current_volume || 0)
      },
      priorityDistribution: prioritySummary.rows,
      recentAssignments: recentAssignments.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

router.get('/routes/:vehicleId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM routes WHERE vehicle_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.params.vehicleId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
