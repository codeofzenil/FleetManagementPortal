require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  console.log('--- Seeding STMPAS with realistic Ahmedabad logistics network ---');
  const client = await pool.connect();

  try {
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
    console.log(`✓ Seeded ${locIds.length} Ahmedabad locations`);

    // 2. Road Network Edges (Undirected Graph with distances in KM & traffic congestion factors)
    // Indexes:
    // 0: SG Highway, 1: Prahlad Nagar, 2: Ashram Road, 3: Kalupur Railway, 4: Naroda GIDC,
    // 5: Sanand GIDC, 6: Changodar, 7: Airport Cargo, 8: Vastrapur, 9: Maninagar,
    // 10: Gandhinagar Infocity, 11: Sarkhej Crossroad
    const edges = [
      [0, 8, 3.2, 1.05],   // SG Highway <-> Vastrapur
      [0, 1, 3.8, 1.10],   // SG Highway <-> Prahlad Nagar
      [0, 5, 16.5, 1.05],  // SG Highway <-> Sanand GIDC
      [1, 11, 4.0, 1.15],  // Prahlad Nagar <-> Sarkhej
      [11, 6, 9.8, 1.10],  // Sarkhej <-> Changodar Pharma
      [5, 6, 14.2, 1.05],  // Sanand GIDC <-> Changodar
      [8, 2, 4.8, 1.25],   // Vastrapur <-> Ashram Road
      [2, 3, 3.6, 1.40],   // Ashram Road <-> Kalupur
      [3, 9, 4.2, 1.30],   // Kalupur <-> Maninagar
      [3, 4, 7.5, 1.20],   // Kalupur <-> Naroda GIDC
      [4, 7, 6.2, 1.10],   // Naroda GIDC <-> Airport Cargo
      [7, 2, 7.8, 1.25],   // Airport Cargo <-> Ashram Road
      [7, 10, 14.5, 1.05], // Airport Cargo <-> Gandhinagar Infocity
      [0, 10, 18.2, 1.05], // SG Highway <-> Gandhinagar Infocity
      [9, 11, 11.5, 1.15], // Maninagar <-> Sarkhej
    ];

    for (const [a, b, dist, traffic] of edges) {
      await client.query(
        'INSERT INTO road_edges (from_location, to_location, distance_km, traffic_factor) VALUES ($1, $2, $3, $4)',
        [locIds[a], locIds[b], dist, traffic]
      );
    }
    console.log(`✓ Seeded ${edges.length} road network corridors`);

    // 3. Users (Admin, Fleet Manager, Drivers, Customers)
    const hash = await bcrypt.hash('password123', 10);
    const users = [
      { name: 'System Admin', email: 'admin@stmpas.com', role: 'admin' },
      { name: 'Bhavin Mehta (Fleet Lead)', email: 'fleet@stmpas.com', role: 'fleet_manager' },
      { name: 'Rajesh Patel', email: 'rajesh@stmpas.com', role: 'driver' },
      { name: 'Vikram Desai', email: 'vikram@stmpas.com', role: 'driver' },
      { name: 'Hitesh Shah', email: 'hitesh@stmpas.com', role: 'driver' },
      { name: 'Amit Solanki', email: 'amit.driver@stmpas.com', role: 'driver' },
      { name: 'Jignesh Vaghela', email: 'jignesh@stmpas.com', role: 'driver' },
      { name: 'Hardik Joshi', email: 'hardik@stmpas.com', role: 'driver' },
      { name: 'Zydus Healthcare Changodar', email: 'zydus@ahmedabad.com', role: 'customer' },
      { name: 'Adani Supply Chain Solutions', email: 'adani@ahmedabad.com', role: 'customer' },
      { name: 'Arvind Mills Logistics', email: 'arvind@ahmedabad.com', role: 'customer' },
      { name: 'ISRO Space Applications SAC', email: 'sac.isro@ahmedabad.com', role: 'customer' },
    ];

    const userMap = {};
    for (const u of users) {
      const res = await client.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [u.name, u.email, hash, u.role]
      );
      userMap[u.email] = res.rows[0].id;
    }
    console.log(`✓ Seeded ${users.length} user logins (all password: password123)`);

    // 4. Customers
    const customerEmails = ['zydus@ahmedabad.com', 'adani@ahmedabad.com', 'arvind@ahmedabad.com', 'sac.isro@ahmedabad.com'];
    const customerIds = [];
    for (const ce of customerEmails) {
      const res = await client.query(
        'INSERT INTO customers (user_id, phone) VALUES ($1, $2) RETURNING id',
        [userMap[ce], '+91 79 ' + Math.floor(26000000 + Math.random() * 999999)]
      );
      customerIds.push(res.rows[0].id);
    }

    // 5. Vehicles (Gujarat Registration Numbers)
    const vehiclesData = [
      {
        number: 'GJ01-AZ-1024',
        type: 'Tata Ace EV (Electric Van)',
        max_weight_kg: 850,
        max_volume_m3: 6.0,
        fuel_type: 'electric',
        fuel_efficiency: 18.0,
        location_id: locIds[0], // SG Highway
        maintenance_score: 98,
        status: 'available'
      },
      {
        number: 'GJ01-CX-4589',
        type: 'Mahindra Bolero Maxi Truck',
        max_weight_kg: 1500,
        max_volume_m3: 10.0,
        fuel_type: 'diesel',
        fuel_efficiency: 14.2,
        location_id: locIds[1], // Prahlad Nagar
        maintenance_score: 92,
        status: 'available'
      },
      {
        number: 'GJ01-ET-7821',
        type: 'Ashok Leyland Dost+ Commercial',
        max_weight_kg: 1800,
        max_volume_m3: 12.5,
        fuel_type: 'diesel',
        fuel_efficiency: 13.0,
        location_id: locIds[2], // Ashram Road
        maintenance_score: 88,
        status: 'busy'
      },
      {
        number: 'GJ27-BB-3310',
        type: 'Eicher Pro 2049 Heavy Cargo',
        max_weight_kg: 3500,
        max_volume_m3: 22.0,
        fuel_type: 'diesel',
        fuel_efficiency: 8.8,
        location_id: locIds[4], // Naroda GIDC
        maintenance_score: 95,
        status: 'available'
      },
      {
        number: 'GJ01-DX-9904',
        type: 'Tata 407 Gold SFC High-Deck',
        max_weight_kg: 4200,
        max_volume_m3: 26.0,
        fuel_type: 'diesel',
        fuel_efficiency: 7.6,
        location_id: locIds[5], // Sanand GIDC
        maintenance_score: 91,
        status: 'available'
      },
      {
        number: 'GJ01-FK-2115',
        type: 'Piaggio Ape Extra LDX Cargo',
        max_weight_kg: 450,
        max_volume_m3: 3.5,
        fuel_type: 'cng',
        fuel_efficiency: 26.5,
        location_id: locIds[3], // Kalupur Railway
        maintenance_score: 85,
        status: 'maintenance'
      },
    ];

    const vehicleIds = [];
    for (const v of vehiclesData) {
      const res = await client.query(
        `INSERT INTO vehicles (
          vehicle_number, type, max_weight_kg, max_volume_m3, fuel_type, 
          fuel_efficiency_kmpl, current_location_id, maintenance_score, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [v.number, v.type, v.max_weight_kg, v.max_volume_m3, v.fuel_type, v.fuel_efficiency, v.location_id, v.maintenance_score, v.status]
      );
      vehicleIds.push(res.rows[0].id);
    }
    console.log(`✓ Seeded ${vehicleIds.length} Gujarat fleet commercial vehicles`);

    // 6. Drivers (Assigned to vehicles)
    const driversData = [
      { email: 'rajesh@stmpas.com', license: 'GJ01-2018-004312', exp: 6, max_hours: 8, hours_today: 2.5, rating: 4.9, vehIdx: 0, avail: true },
      { email: 'vikram@stmpas.com', license: 'GJ01-2016-009841', exp: 8, max_hours: 8, hours_today: 3.0, rating: 4.8, vehIdx: 1, avail: true },
      { email: 'hitesh@stmpas.com', license: 'GJ01-2020-001255', exp: 4, max_hours: 8, hours_today: 6.5, rating: 4.7, vehIdx: 2, avail: true },
      { email: 'amit.driver@stmpas.com', license: 'GJ27-2017-007732', exp: 7, max_hours: 9, hours_today: 1.0, rating: 5.0, vehIdx: 3, avail: true },
      { email: 'jignesh@stmpas.com', license: 'GJ01-2015-003390', exp: 9, max_hours: 8, hours_today: 0.0, rating: 4.9, vehIdx: 4, avail: true },
      { email: 'hardik@stmpas.com', license: 'GJ01-2021-008129', exp: 3, max_hours: 8, hours_today: 4.0, rating: 4.6, vehIdx: 5, avail: false },
    ];

    const driverIds = [];
    for (const d of driversData) {
      const res = await client.query(
        `INSERT INTO drivers (user_id, license_no, experience_years, max_working_hours, working_hours_today, rating, availability, assigned_vehicle_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [userMap[d.email], d.license, d.exp, d.max_hours, d.hours_today, d.rating, d.avail, vehicleIds[d.vehIdx]]
      );
      const dId = res.rows[0].id;
      driverIds.push(dId);
      // Link back to vehicle
      await client.query('UPDATE vehicles SET driver_id = $1 WHERE id = $2', [dId, vehicleIds[d.vehIdx]]);
    }
    console.log(`✓ Seeded and linked ${driverIds.length} certified drivers`);

    // 7. Seed Parcels with realistic consignment descriptions, weights, deadlines, and statuses
    // Mix of: Pending (ready for AMFOA allocation right now!), Assigned, In-Transit, Delivered
    const parcelsData = [
      // Pending parcels for immediate AMFOA testing & Knapsack DP optimization:
      {
        custIdx: 0,
        pickupIdx: 6, // Changodar Pharma Zone
        deliveryIdx: 9, // Maninagar Depot
        weight: 120,
        volume: 0.9,
        priority: 1, // Critical
        fragile: true,
        deadlineHours: 4,
        instructions: 'Cold-chain required (2-8°C). Critical vaccine consignment for Maninagar distribution.',
        status: 'pending'
      },
      {
        custIdx: 1,
        pickupIdx: 5, // Sanand GIDC
        deliveryIdx: 8, // Vastrapur Hub
        weight: 340,
        volume: 2.2,
        priority: 2,
        fragile: false,
        deadlineHours: 8,
        instructions: 'Automotive wiring harnesses and ECU electronics.',
        status: 'pending'
      },
      {
        custIdx: 2,
        pickupIdx: 4, // Naroda GIDC
        deliveryIdx: 3, // Kalupur Railway Terminal
        weight: 620,
        volume: 3.8,
        priority: 3,
        fragile: false,
        deadlineHours: 12,
        instructions: 'Export grade denim textiles batch for container freight.',
        status: 'pending'
      },
      {
        custIdx: 3,
        pickupIdx: 8, // Vastrapur SAC
        deliveryIdx: 7, // Airport Cargo
        weight: 85,
        volume: 0.6,
        priority: 1,
        fragile: true,
        deadlineHours: 3,
        instructions: 'Spacecraft sensor instruments - handle with extreme care. High security.',
        status: 'pending'
      },
      {
        custIdx: 1,
        pickupIdx: 10, // Gandhinagar Infocity
        deliveryIdx: 1, // Prahlad Nagar
        weight: 180,
        volume: 1.4,
        priority: 2,
        fragile: true,
        deadlineHours: 6,
        instructions: 'High-density enterprise SSD storage racks.',
        status: 'pending'
      },
      {
        custIdx: 0,
        pickupIdx: 6, // Changodar
        deliveryIdx: 4, // Naroda GIDC
        weight: 450,
        volume: 2.8,
        priority: 3,
        fragile: false,
        deadlineHours: 24,
        instructions: 'Pharmaceutical active raw compounds.',
        status: 'pending'
      },

      // Assigned & active parcels (so vehicle loads and score breakdowns are live):
      {
        custIdx: 1,
        pickupIdx: 0, // SG Highway Hub
        deliveryIdx: 1, // Prahlad Nagar
        weight: 220,
        volume: 1.2,
        priority: 2,
        fragile: false,
        deadlineHours: 5,
        instructions: 'Telecommunications routing gear.',
        status: 'assigned',
        assignedVehIdx: 0, // Tata Ace EV
        assignedDriverIdx: 0,
        score: 0.884,
        breakdown: {
          distanceKm: 3.8,
          distScore: 0.924,
          capacityScore: 0.741,
          deadlineScore: 0.896,
          fuelScore: 0.900,
          driverHoursScore: 0.688,
          healthScore: 0.980,
          priorityScore: 0.750
        }
      },
      {
        custIdx: 2,
        pickupIdx: 2, // Ashram Road
        deliveryIdx: 3, // Kalupur Railway
        weight: 480,
        volume: 3.1,
        priority: 1,
        fragile: true,
        deadlineHours: 3,
        instructions: 'High value apparel samples for international exhibition.',
        status: 'assigned',
        assignedVehIdx: 2, // Ashok Leyland Dost
        assignedDriverIdx: 2,
        score: 0.812,
        breakdown: {
          distanceKm: 3.6,
          distScore: 0.928,
          capacityScore: 0.733,
          deadlineScore: 0.938,
          fuelScore: 0.650,
          driverHoursScore: 0.188,
          healthScore: 0.880,
          priorityScore: 1.000
        }
      },
      // In transit parcel:
      {
        custIdx: 3,
        pickupIdx: 11, // Sarkhej Crossroad
        deliveryIdx: 2, // Ashram Road
        weight: 150,
        volume: 1.0,
        priority: 2,
        fragile: false,
        deadlineHours: 4,
        instructions: 'Renewable energy inverter components.',
        status: 'in_transit',
        assignedVehIdx: 1, // Bolero Maxi Truck
        assignedDriverIdx: 1,
        score: 0.845,
        breakdown: {
          distanceKm: 8.8,
          distScore: 0.824,
          capacityScore: 0.900,
          deadlineScore: 0.917,
          fuelScore: 0.710,
          driverHoursScore: 0.625,
          healthScore: 0.920,
          priorityScore: 0.750
        }
      },
      // Delivered parcel:
      {
        custIdx: 0,
        pickupIdx: 6, // Changodar
        deliveryIdx: 8, // Vastrapur
        weight: 90,
        volume: 0.8,
        priority: 1,
        fragile: true,
        deadlineHours: -2,
        instructions: 'Specialized medical diagnostics reagents.',
        status: 'delivered',
        assignedVehIdx: 0,
        assignedDriverIdx: 0,
        score: 0.915,
        breakdown: {
          distanceKm: 14.6,
          distScore: 0.708,
          capacityScore: 0.894,
          deadlineScore: 0.950,
          fuelScore: 0.900,
          driverHoursScore: 0.750,
          healthScore: 0.980,
          priorityScore: 1.000
        }
      }
    ];

    for (const p of parcelsData) {
      const deadline = new Date(Date.now() + p.deadlineHours * 3600 * 1000);
      const pRes = await client.query(
        `INSERT INTO parcels (
          customer_id, pickup_location_id, delivery_location_id, weight_kg, volume_m3, 
          priority, fragile, deadline, special_instructions, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          customerIds[p.custIdx],
          locIds[p.pickupIdx],
          locIds[p.deliveryIdx],
          p.weight,
          p.volume,
          p.priority,
          p.fragile,
          deadline,
          p.instructions,
          p.status
        ]
      );
      const parcelId = pRes.rows[0].id;

      if (p.assignedVehIdx !== undefined) {
        const vId = vehicleIds[p.assignedVehIdx];
        const dId = driverIds[p.assignedDriverIdx];
        const isDelivered = (p.status === 'delivered');

        await client.query(
          `INSERT INTO assignments (parcel_id, vehicle_id, driver_id, optimization_score, score_breakdown, status, delivered_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            parcelId,
            vId,
            dId,
            p.score,
            JSON.stringify(p.breakdown),
            isDelivered ? 'completed' : 'assigned',
            isDelivered ? new Date() : null
          ]
        );

        if (!isDelivered) {
          // Accumulate load on vehicle
          await client.query(
            `UPDATE vehicles SET current_load_kg = current_load_kg + $1, current_volume_m3 = current_volume_m3 + $2 WHERE id = $3`,
            [p.weight, p.volume, vId]
          );
        }
      }
    }
    console.log(`✓ Seeded ${parcelsData.length} parcels with full AMFOA score breakdowns across Ahmedabad`);

    // 8. Fuel logs & initial route for active vehicle
    await client.query(
      `INSERT INTO fuel_logs (vehicle_id, liters_used, distance_km) VALUES 
       ($1, 14.5, 95.0),
       ($2, 22.0, 165.0),
       ($3, 18.2, 140.0)`,
      [vehicleIds[1], vehicleIds[2], vehicleIds[3]]
    );

    await client.query(
      `INSERT INTO routes (vehicle_id, stop_sequence, total_distance_km, estimated_time_min) VALUES
       ($1, $2, 12.4, 25)`,
      [vehicleIds[0], JSON.stringify([locIds[0], locIds[1], locIds[8]])]
    );

    await client.query('COMMIT');

    console.log('\n======================================================');
    console.log(' Ahmedabad Logistics Fleet & AMFOA Network Ready!');
    console.log('======================================================');
    console.log('Demo Credentials (password: password123 for all):');
    console.log('  👑 System Admin:    admin@stmpas.com');
    console.log('  🚛 Fleet Manager:   fleet@stmpas.com');
    console.log('  👤 Drivers:         rajesh@stmpas.com, vikram@stmpas.com, hitesh@stmpas.com');
    console.log('                      amit.driver@stmpas.com, jignesh@stmpas.com, hardik@stmpas.com');
    console.log('  🏢 Customers:       zydus@ahmedabad.com, adani@ahmedabad.com');
    console.log('======================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

seed().then(() => {
  pool.end();
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
