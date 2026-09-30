-- STMPAS Database Schema

CREATE TYPE user_role AS ENUM ('admin','fleet_manager','driver','customer');
CREATE TYPE parcel_status AS ENUM ('pending','assigned','in_transit','delivered','failed');
CREATE TYPE vehicle_status AS ENUM ('available','busy','maintenance','offline');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL
);

-- Road network graph used by Dijkstra / A* for shortest-path routing
CREATE TABLE road_edges (
  id SERIAL PRIMARY KEY,
  from_location INT REFERENCES locations(id),
  to_location INT REFERENCES locations(id),
  distance_km DOUBLE PRECISION NOT NULL,
  traffic_factor DOUBLE PRECISION DEFAULT 1.0 -- 1.0 = normal, >1 = congested
);

CREATE TABLE vehicles (
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
  current_location_id INT REFERENCES locations(id),
  driver_id INT,
  maintenance_score DOUBLE PRECISION DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE drivers (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  license_no VARCHAR(50),
  experience_years INT DEFAULT 0,
  working_hours_today DOUBLE PRECISION DEFAULT 0,
  max_working_hours DOUBLE PRECISION DEFAULT 8,
  assigned_vehicle_id INT REFERENCES vehicles(id),
  availability BOOLEAN DEFAULT TRUE,
  rating DOUBLE PRECISION DEFAULT 5.0
);

ALTER TABLE vehicles ADD CONSTRAINT fk_vehicle_driver FOREIGN KEY (driver_id) REFERENCES drivers(id);

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(20)
);

CREATE TABLE parcels (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id),
  pickup_location_id INT REFERENCES locations(id),
  delivery_location_id INT REFERENCES locations(id),
  weight_kg DOUBLE PRECISION NOT NULL,
  volume_m3 DOUBLE PRECISION NOT NULL,
  priority INT DEFAULT 3, -- 1 = highest priority ... 5 = lowest
  fragile BOOLEAN DEFAULT FALSE,
  deadline TIMESTAMP NOT NULL,
  special_instructions TEXT,
  status parcel_status DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  parcel_id INT REFERENCES parcels(id),
  vehicle_id INT REFERENCES vehicles(id),
  driver_id INT REFERENCES drivers(id),
  optimization_score DOUBLE PRECISION,
  score_breakdown JSONB,
  assigned_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'assigned'
);

CREATE TABLE routes (
  id SERIAL PRIMARY KEY,
  vehicle_id INT REFERENCES vehicles(id),
  stop_sequence JSONB NOT NULL, -- ordered list of location ids from Held-Karp DP / nearest-neighbor
  total_distance_km DOUBLE PRECISION,
  estimated_time_min DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fuel_logs (
  id SERIAL PRIMARY KEY,
  vehicle_id INT REFERENCES vehicles(id),
  liters_used DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  logged_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE maintenance (
  id SERIAL PRIMARY KEY,
  vehicle_id INT REFERENCES vehicles(id),
  description TEXT,
  status VARCHAR(20) DEFAULT 'scheduled',
  scheduled_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_parcels_status ON parcels(status);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_assignments_vehicle ON assignments(vehicle_id);
CREATE INDEX idx_assignments_driver ON assignments(driver_id);
