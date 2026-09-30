require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function runSeed() {
  console.log('--- Initializing & Seeding FleetManagementPortal Database ---');
  const client = await pool.connect();

  try {
    // Step 1: Ensure types exist idempotently
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM ('admin','fleet_manager','driver','customer');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'parcel_status') THEN
          CREATE TYPE parcel_status AS ENUM ('pending','assigned','in_transit','delivered','failed');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
          CREATE TYPE vehicle_status AS ENUM ('available','busy','maintenance','offline');
        END IF;
      END $$;
    `);

    // Step 2: Ensure tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role user_role NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL
      );

      CREATE TABLE IF NOT EXISTS road_edges (
        id SERIAL PRIMARY KEY,
        from_location INT REFERENCES locations(id) ON DELETE CASCADE,
        to_location INT REFERENCES locations(id) ON DELETE CASCADE,
        distance_km DOUBLE PRECISION NOT NULL,
        traffic_factor DOUBLE PRECISION DEFAULT 1.0
      );

      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        vehicle_number VARCHAR(30) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        max_weight_kg DOUBLE PRECISION NOT NULL,
        max_volume_m3 DOUBLE PRECISION NOT NULL,
        fuel_type VARCHAR(20) DEFAULT 'diesel',
        fuel_efficiency_kmpl DOUBLE PRECISION DEFAULT 10,
        current_load_kg DOUBLE PRECISION DEFAULT 0,
        current_volume_m3 DOUBLE PRECISION DEFAULT 0,
        status vehicle_status DEFAULT 'available',
        current_location_id INT REFERENCES locations(id) ON DELETE SET NULL,
        driver_id INT,
        maintenance_score DOUBLE PRECISION DEFAULT 100,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drivers (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        license_no VARCHAR(50),
        experience_years INT DEFAULT 0,
        working_hours_today DOUBLE PRECISION DEFAULT 0,
        max_working_hours DOUBLE PRECISION DEFAULT 8,
        assigned_vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
        availability BOOLEAN DEFAULT TRUE,
        rating DOUBLE PRECISION DEFAULT 5.0
      );

      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        phone VARCHAR(20)
      );

      CREATE TABLE IF NOT EXISTS parcels (
        id SERIAL PRIMARY KEY,
        customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
        pickup_location_id INT REFERENCES locations(id),
        delivery_location_id INT REFERENCES locations(id),
        weight_kg DOUBLE PRECISION NOT NULL,
        volume_m3 DOUBLE PRECISION NOT NULL,
        priority INT DEFAULT 3,
        deadline TIMESTAMP NOT NULL,
        fragile BOOLEAN DEFAULT FALSE,
        special_instructions TEXT,
        status parcel_status DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        parcel_id INT REFERENCES parcels(id) ON DELETE CASCADE,
        vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
        driver_id INT REFERENCES drivers(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'assigned',
        optimization_score DOUBLE PRECISION,
        score_breakdown JSONB
      );

      CREATE TABLE IF NOT EXISTS routes (
        id SERIAL PRIMARY KEY,
        vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
        total_distance_km DOUBLE PRECISION NOT NULL,
        estimated_time_min DOUBLE PRECISION NOT NULL,
        path_nodes JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS fuel_logs (
        id SERIAL PRIMARY KEY,
        vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
        fuel_consumed_liters DOUBLE PRECISION NOT NULL,
        distance_covered_km DOUBLE PRECISION NOT NULL,
        logged_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS maintenance (
        id SERIAL PRIMARY KEY,
        vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        cost DOUBLE PRECISION,
        maintenance_date TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Step 3: Populate seed data in transaction
    await client.query('BEGIN');

    // Clean existing tables in correct order
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM maintenance');
    await client.query('DELETE FROM fuel_logs');
    await client.query('DELETE FROM routes');
    await client.query('DELETE FROM assignments');
    await client.query('DELETE FROM parcels');
    await client.query('UPDATE vehicles SET driver_id = NULL');
    await client.query('DELETE FROM drivers');
    await client.query('DELETE FROM vehicles');
    await client.query('DELETE FROM customers');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM road_edges');
    await client.query('DELETE FROM locations');

    // 1. Ahmedabad Locations (Nodes of the Road Network)
    const ahmedabadLocations = [
      { name: 'SG Highway Logistics Hub', lat: 23.0338, lng: 72.5050 },
      { name: 'Prahlad Nagar Commercial Hub', lat: 23.0125, lng: 72.5108 },
      { name: 'Ashram Road Central Depot', lat: 23.0360, lng: 72.5700 },
      { name: 'Kalupur Railway Freight Terminal', lat: 23.0280, lng: 72.6010 },
      { name: 'Naroda GIDC Industrial Hub', lat: 23.0680, lng: 72.6580 },
      { name: 'Sanand GIDC Mega Logistics Park', lat: 22.9850, lng: 72.3780 },
      { name: 'Changodar Logistics & Pharma Zone', lat: 22.9220, lng: 72.4430 },
      { name: 'SVPI Airport Air Cargo Complex', lat: 23.0734, lng: 72.6266 },
      { name: 'Vastrapur / IIM Hub', lat: 23.0350, lng: 72.5280 },
      { name: 'Maninagar Delivery Depot', lat: 22.9980, lng: 72.6100 },
      { name: 'Gandhinagar Infocity Tech Park', lat: 23.1950, lng: 72.6320 },
      { name: 'Sarkhej Crossroad Transit Center', lat: 22.9880, lng: 72.4950 },
    ];

    const locIds = [];
    for (const loc of ahmedabadLocations) {
      const res = await client.query(
        'INSERT INTO locations (name, lat, lng) VALUES ($1, $2, $3) RETURNING id',
        [loc.name, loc.lat, loc.lng]
      );
      locIds.push(res.rows[0].id);
    }

    // 2. Road Network Edges
    const edges = [
      [0, 8, 3.2, 1.05],
      [0, 1, 3.8, 1.10],
      [0, 5, 16.5, 1.05],
      [1, 11, 4.0, 1.15],
      [11, 6, 9.8, 1.10],
      [5, 6, 14.2, 1.05],
      [8, 2, 4.8, 1.25],
      [2, 3, 3.6, 1.40],
      [3, 9, 4.2, 1.30],
      [3, 4, 7.5, 1.20],
      [4, 7, 6.2, 1.10],
      [7, 2, 7.8, 1.25],
      [7, 10, 13.5, 1.05],
      [0, 10, 18.0, 1.10],
      [11, 9, 8.5, 1.20],
    ];

    for (const [from, to, dist, traffic] of edges) {
      await client.query(
        'INSERT INTO road_edges (from_location, to_location, distance_km, traffic_factor) VALUES ($1, $2, $3, $4)',
        [locIds[from], locIds[to], dist, traffic]
      );
    }

    // 3. Vehicles
    const vehiclesData = [
      { num: 'GJ01-AZ-1024', type: 'Tata Ace EV (Electric Van)', maxW: 850, maxV: 6.0, fuel: 'electric', kmpl: 20, loc: locIds[0], maint: 96 },
      { num: 'GJ01-BT-4096', type: 'Mahindra Bolero Maxi Truck', maxW: 1200, maxV: 8.5, fuel: 'diesel', kmpl: 14, loc: locIds[5], maint: 92 },
      { num: 'GJ01-CX-5512', type: 'Eicher Pro 2049 Commercial', maxW: 2400, maxV: 15.0, fuel: 'diesel', kmpl: 9, loc: locIds[6], maint: 88 },
      { num: 'GJ01-ET-7821', type: 'Ashok Leyland Dost+ Commercial', maxW: 1800, maxV: 12.5, fuel: 'diesel', kmpl: 12, loc: locIds[4], maint: 95 },
      { num: 'GJ01-DW-9901', type: 'Tata Intra V30 Smart Pickup', maxW: 1300, maxV: 9.0, fuel: 'cng', kmpl: 16, loc: locIds[2], maint: 90 },
      { num: 'GJ01-FK-2115', type: 'Piaggio Ape Extra LDX Cargo', maxW: 450, maxV: 3.5, fuel: 'cng', kmpl: 22, loc: locIds[3], maint: 85 },
    ];

    const vIds = [];
    for (const v of vehiclesData) {
      const res = await client.query(
        `INSERT INTO vehicles (vehicle_number, type, max_weight_kg, max_volume_m3, fuel_type, fuel_efficiency_kmpl, current_location_id, maintenance_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [v.num, v.type, v.maxW, v.maxV, v.fuel, v.kmpl, v.loc, v.maint]
      );
      vIds.push(res.rows[0].id);
    }

    // 4. Users (Admin, Fleet Manager, Customer, Drivers)
    const pass = await bcrypt.hash('password123', 10);

    const adminRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('Zenil Admin', 'admin@stmpas.com', $1, 'admin') RETURNING id`,
      [pass]
    );

    const fleetRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('Aarav Fleet Manager', 'fleet@stmpas.com', $1, 'fleet_manager') RETURNING id`,
      [pass]
    );

    const custUser = await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('Adani Logistics Ahmedabad', 'logistics@adani.com', $1, 'customer') RETURNING id`,
      [pass]
    );
    const customerRes = await client.query(
      `INSERT INTO customers (user_id, phone) VALUES ($1, '+91 79 2656 5555') RETURNING id`,
      [custUser.rows[0].id]
    );
    const customerId = customerRes.rows[0].id;

    // 5. Drivers
    const driversData = [
      { name: 'Rajesh Patel', email: 'rajesh@stmpas.com', license: 'GJ-01-2018-0045123', exp: 6, hrs: 3.5, maxHrs: 8, vIdx: 0, rating: 4.8 },
      { name: 'Vikram Desai', email: 'vikram@stmpas.com', license: 'GJ-01-2016-0098412', exp: 8, hrs: 2.0, maxHrs: 8, vIdx: 1, rating: 4.9 },
      { name: 'Hitesh Prajapati', email: 'hitesh@stmpas.com', license: 'GJ-01-2020-0012984', exp: 4, hrs: 5.0, maxHrs: 8, vIdx: 2, rating: 4.6 },
      { name: 'Amit Shah', email: 'amit.driver@stmpas.com', license: 'GJ-01-2019-0077651', exp: 5, hrs: 1.5, maxHrs: 8, vIdx: 3, rating: 4.7 },
      { name: 'Jignesh Vaghela', email: 'jignesh@stmpas.com', license: 'GJ-01-2017-0033214', exp: 7, hrs: 0.0, maxHrs: 8, vIdx: 4, rating: 5.0 },
      { name: 'Hardik Solanki', email: 'hardik@stmpas.com', license: 'GJ-01-2021-0065432', exp: 3, hrs: 0.0, maxHrs: 8, vIdx: 5, rating: 4.5 },
    ];

    const dIds = [];
    for (const d of driversData) {
      const uRes = await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'driver') RETURNING id`,
        [d.name, d.email, pass]
      );
      const vId = vIds[d.vIdx];
      const dRes = await client.query(
        `INSERT INTO drivers (user_id, license_no, experience_years, working_hours_today, max_working_hours, assigned_vehicle_id, rating)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [uRes.rows[0].id, d.license, d.exp, d.hrs, d.maxHrs, vId, d.rating]
      );
      dIds.push(dRes.rows[0].id);
      await client.query('UPDATE vehicles SET driver_id = $1 WHERE id = $2', [dRes.rows[0].id, vId]);
    }

    // 6. Parcels
    const now = Date.now();
    const parcelsData = [
      { from: locIds[5], to: locIds[0], w: 180, v: 1.2, p: 1, hrs: 2, fragile: false, name: 'Automotive Spares (Sanand -> SG Highway)' },
      { from: locIds[6], to: locIds[7], w: 125, v: 0.6, p: 1, hrs: 3, fragile: true,  name: 'Active Pharma Vaccine Batch (Changodar -> Airport)' },
      { from: locIds[4], to: locIds[1], w: 320, v: 2.4, p: 2, hrs: 5, fragile: false, name: 'Chemical Reagents (Naroda -> Prahlad Nagar)' },
      { from: locIds[3], to: locIds[10], w: 95,  v: 0.5, p: 2, hrs: 6, fragile: true,  name: 'Server Electronics (Kalupur -> Infocity)' },
      { from: locIds[0], to: locIds[9], w: 45,  v: 0.3, p: 3, hrs: 8, fragile: false, name: 'Retail FMCG Consignment (SG Highway -> Maninagar)' },
      { from: locIds[11], to: locIds[2], w: 210, v: 1.5, p: 2, hrs: 7, fragile: false, name: 'Cotton Textile Bale (Sarkhej -> Ashram Road)' },
      { from: locIds[5], to: locIds[4], w: 340, v: 2.2, p: 2, hrs: 12, fragile: false, name: 'Sanand Assembly Parts -> Naroda Depot' },
      { from: locIds[6], to: locIds[3], w: 620, v: 3.8, p: 3, hrs: 16, fragile: false, name: 'Changodar Industrial Consignment -> Kalupur' },
      { from: locIds[8], to: locIds[10], w: 35,  v: 0.2, p: 1, hrs: 4, fragile: true,  name: 'Vastrapur Medical Samples -> Infocity Lab' },
      { from: locIds[7], to: locIds[5], w: 450, v: 2.8, p: 3, hrs: 24, fragile: false, name: 'Imported Machinery Parts (Airport -> Sanand)' },
    ];

    const pIds = [];
    for (const p of parcelsData) {
      const deadline = new Date(now + p.hrs * 36e5).toISOString();
      const res = await client.query(
        `INSERT INTO parcels (customer_id, pickup_location_id, delivery_location_id, weight_kg, volume_m3, priority, deadline, fragile)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [customerId, p.from, p.to, p.w, p.v, p.p, deadline, p.fragile]
      );
      pIds.push(res.rows[0].id);
    }

    // 7. Initial Assignments (seed first 5 parcels as assigned to showcase analytics)
    const initialAssignments = [
      { pIdx: 0, vIdx: 0, dIdx: 0, score: 87.5 },
      { pIdx: 1, vIdx: 0, dIdx: 0, score: 91.2 },
      { pIdx: 2, vIdx: 1, dIdx: 1, score: 84.0 },
      { pIdx: 3, vIdx: 3, dIdx: 3, score: 88.6 },
      { pIdx: 4, vIdx: 0, dIdx: 0, score: 79.4 },
    ];

    for (const a of initialAssignments) {
      const p = parcelsData[a.pIdx];
      const pId = pIds[a.pIdx];
      const vId = vIds[a.vIdx];
      const dId = dIds[a.dIdx];

      await client.query(
        `INSERT INTO assignments (parcel_id, vehicle_id, driver_id, optimization_score, status, score_breakdown)
         VALUES ($1, $2, $3, $4, 'assigned', $5)`,
        [
          pId,
          vId,
          dId,
          a.score,
          JSON.stringify({
            distanceScore: 88,
            capacityScore: 82,
            volumeScore: 90,
            driverScore: 95,
            fuelScore: 85,
            urgencyScore: 90,
            fragileScore: 100,
          }),
        ]
      );

      await client.query("UPDATE parcels SET status = 'assigned' WHERE id = $1", [pId]);
      await client.query(
        'UPDATE vehicles SET current_load_kg = current_load_kg + $1, current_volume_m3 = current_volume_m3 + $2, status = $3 WHERE id = $4',
        [p.w, p.v, 'busy', vId]
      );
    }

    await client.query('COMMIT');
    console.log('✓ FleetManagementPortal database seeded successfully!');

    return {
      success: true,
      message: 'FleetManagementPortal database schema verified and seeded successfully!',
      timestamp: new Date().toISOString(),
      counts: {
        locations: locIds.length,
        roadEdges: edges.length,
        vehicles: vIds.length,
        drivers: dIds.length,
        users: 3 + driversData.length,
        parcels: pIds.length,
        activeAssignments: initialAssignments.length,
      },
      demoLogins: [
        { role: 'admin', email: 'admin@stmpas.com', password: 'password123' },
        { role: 'fleet_manager', email: 'fleet@stmpas.com', password: 'password123' },
        { role: 'driver', email: 'rajesh@stmpas.com', password: 'password123' },
      ],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during database seed:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { runSeed };
