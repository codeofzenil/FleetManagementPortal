# FleetManagementPortal

> **Smart Transportation Management & Multi-Constraint Fleet Parcel Allocation System**  
> An enterprise-grade, algorithmically-driven logistics and fleet management platform powered by modern web technologies and real-world Design and Analysis of Algorithms (DAA) engines.

---

## 🌟 Overview

**FleetManagementPortal** is a full-stack smart transportation and logistics dispatch platform designed to solve complex multi-vehicle dispatch, capacity optimization, and multi-stop routing problems. 

At its core is the **Adaptive Multi-Constraint Fleet Optimization Algorithm (AMFOA)**, which orchestrates vehicle selection, payload constraints, driver shift constraints, and pathfinding across realistic road networks (seeded with Ahmedabad's primary industrial and logistics corridors).

---

## 🚀 Key Features

- **🧠 AMFOA Engine (7-Factor Weighted Scoring)**: Evaluates candidate vehicles based on travel distance, payload capacity utilization, volumetric fit, driver shift hours, vehicle fuel efficiency, delivery deadline urgency, and fragile consignment handling.
- **🎒 2D Knapsack Load Maximizer**: An exact branch-and-bound 0/1 multi-constraint knapsack algorithm with density heuristic sorting (`value / (w/maxW + v/maxV)`) that maximizes total delivery priority within hard payload weight (kg) and volume (m³) vehicle budgets, complete with 1-click batch allocation.
- **🗺️ Dijkstra & A\* Road Network Routing**: Shortest-path routing over weighted road-network graphs with traffic-factor multipliers powered by custom min-heaps.
- **🔄 Held-Karp Bitmask DP Route Sequencing**: Exact Traveling Salesperson Problem (TSP) dynamic programming algorithm ($O(n^2 2^n)$) for optimal stop sequencing on vehicles with multi-parcel dispatches.
- **🚚 Comprehensive Role-Based Dashboards**:
  - **Admin Dashboard**: System health metrics, fleet analytics, driver login CRUD with bcrypt hashing, vehicle fleet management, parcel tracking, and AMFOA score breakdown visualizers.
  - **Fleet Manager Dashboard**: Dispatch command center, pending parcel queue, live Leaflet map with hub coordinates, Knapsack load optimization tool, and route DP optimizer.
  - **Driver Dashboard**: Active assignments, delivery progression (`pending` → `assigned` → `in_transit` → `delivered`), step-by-step route directions, and shift hour tracking.
- **⚡ Universal Data Table with Sorting & Multi-Column Filtering**: High-performance table sorting (numeric, text, date, boolean) with global keyword search, per-column filters, and pagination across every data view.
- **🌙 Complete Dark Mode**: Seamless dark and light mode toggle with state persistence.
- **📍 Real-World Ahmedabad Logistics Network**: Pre-seeded with 12 real-world logistics nodes (Sanand GIDC, Changodar, Naroda, Sarkhej, SG Highway, Kalupur Terminal, etc.) and connecting transit corridors.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Leaflet, React-Leaflet, Axios, React Router 6 |
| **Backend** | Node.js, Express.js, PostgreSQL Client (`pg`), JWT, Bcrypt |
| **Database** | PostgreSQL (Relational schema with foreign keys, checks, and transactions) |
| **Algorithms** | AMFOA (Multi-criteria greedy), 2D Branch-and-Bound Knapsack, Dijkstra/A\*, Held-Karp TSP DP, Priority Queue Min-Heap, Merge Sort |

---

## 📐 Algorithmic Architecture (DAA Implementation)

| Algorithmic Paradigm | Implementation File | Mathematical & Operational Function |
|---|---|---|
| **Adaptive Multi-Criteria Optimization (AMFOA)** | [`backend/algorithms/amfoa.js`](backend/algorithms/amfoa.js) | Evaluates candidate vehicles across 7 weighted normalized criteria: distance ($w_1=0.25$), capacity utilization ($w_2=0.20$), volume fit ($w_3=0.15$), driver hours ($w_4=0.15$), fuel economy ($w_5=0.10$), urgency bonus ($w_6=0.10$), and fragile handling ($w_7=0.05$). |
| **2D Multi-Constraint Knapsack** | [`backend/algorithms/knapsack.js`](backend/algorithms/knapsack.js) | Solves the 2-dimensional 0/1 knapsack problem under simultaneous weight ($W$) and volume ($V$) constraints. Uses density heuristic sorting with suffix-potential upper bound pruning and payload load maximization tie-breakers. |
| **Graph Shortest Path (Dijkstra / A\*)** | [`backend/algorithms/graph.js`](backend/algorithms/graph.js) | Computes optimal point-to-point transit paths across the road network graph considering edge distance ($\text{km}$) scaled by real-time traffic congestion factors. Includes Haversine-accelerated A\* search. |
| **Traveling Salesperson DP (Held-Karp)** | [`backend/algorithms/tspDP.js`](backend/algorithms/tspDP.js) | Bitmask dynamic programming computing exact optimal sequence for up to 12 delivery stops in $O(n^2 2^n)$ time; gracefully falls back to 2-opt nearest-neighbor for larger stop lists. |
| **Priority Queue (Min-Heap)** | [`backend/algorithms/priorityQueue.js`](backend/algorithms/priorityQueue.js) | Binary min-heap ordering pending batch parcels by urgency score and powering Dijkstra's vertex extraction in $O(\log V)$ time. |
| **Divide & Conquer (Merge Sort)** | [`backend/algorithms/mergeSort.js`](backend/algorithms/mergeSort.js) | Stable $O(n \log n)$ sorting algorithm ordering parcel queues by deadline timestamps and priority levels. |

---

## 👥 Demo User Accounts

All pre-seeded demo accounts use the standard password: **`password123`**

| Role | Email | Description |
|---|---|---|
| **Admin** | `admin@stmpas.com` | Full administrative control, system metrics, driver login management, vehicle fleet CRUD, parcel dispatching, and AMFOA scoring breakdowns. |
| **Fleet Manager** | `fleet@stmpas.com` | Real-time fleet monitoring, map dispatch, parcel management, 0/1 Knapsack load maximizer, and Held-Karp multi-stop route DP solver. |
| **Fleet Driver** | `rajesh@stmpas.com` | Assigned to Tata Ace EV (`GJ01-AZ-1024`). Active delivery execution, route viewer, and shift logger. |
| **Fleet Driver** | `vikram@stmpas.com` | Assigned to Ashok Leyland Dost+ (`GJ01-BT-4096`). |
| **Fleet Driver** | `hitesh@stmpas.com` | Assigned to Mahindra Bolero Maxi Truck (`GJ01-CX-5512`). |
| **Fleet Driver** | `amit.driver@stmpas.com` | Assigned to Eicher Pro 2049 (`GJ01-DW-9901`). |
| **Fleet Driver** | `jignesh@stmpas.com` | Assigned to Piaggio Ape Extra LDX Cargo (`GJ01-FK-2115`). |
| **Fleet Driver** | `hardik@stmpas.com` | Assigned to Tata Intra V30 Smart Pickup (`GJ01-ET-7821`). |

*(Quick 1-click demo login buttons are provided directly on the Login page).*

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14.0 or higher
- **npm** or **yarn**

### 2. Database Setup
Ensure PostgreSQL is running locally, then initialize the database:

```bash
# Connect to PostgreSQL and create database
createdb stmpas2

# Execute the schema migration
psql -d stmpas2 -f backend/db/schema.sql
```

### 3. Backend Setup
```bash
cd backend

# Create environment configuration from template
cp .env.example .env

# Verify database credentials in .env:
# PORT=5000
# PGUSER=postgres
# PGPASSWORD=your_postgres_password
# PGDATABASE=stmpas2
# JWT_SECRET=your_secret_key

# Install dependencies
npm install

# Seed Ahmedabad logistics hubs, road edges, vehicles, drivers, and parcels
npm run seed

# Start development server
npm run dev
# Server runs on http://localhost:5000
```

### 4. Frontend Setup
```bash
cd frontend

# Create environment configuration
cp .env.example .env

# Install dependencies
npm install

# Start Vite development server
npm run dev
# Application accessible at http://localhost:3000
```

---

## 📡 REST API Reference

### Authentication
- `POST /api/auth/register` — Register a new account
- `POST /api/auth/login` — Authenticate and receive JWT bearer token

### Vehicles
- `GET /api/vehicles` — Retrieve all vehicles with status, current location, and driver info
- `POST /api/vehicles` — Create a new vehicle *(Admin only)*
- `PUT /api/vehicles/:id` — Update vehicle specifications and status *(Admin, Fleet Manager)*
- `DELETE /api/vehicles/:id` — Delete vehicle *(Admin only)*
- `GET /api/vehicles/:id/score-breakdown` — Calculate vehicle readiness score ($0\text{--}100$) and operational health factors

### Drivers & Logins
- `GET /api/drivers` — Retrieve all drivers with login credentials, vehicle assignment, and shift hours
- `POST /api/drivers` — Create driver record and companion user authentication account *(Admin only)*
- `PUT /api/drivers/:id` — Update driver details, vehicle assignment, and password *(Admin only)*
- `DELETE /api/drivers/:id` — Remove driver and associated login account *(Admin only)*

### Parcels & Consignments
- `GET /api/parcels` — List all parcels ordered by deadline (custom merge sort)
- `POST /api/parcels` — Create new delivery consignment *(Admin, Fleet Manager)*
- `PUT /api/parcels/:id` — Update consignment specifications *(Admin, Fleet Manager)*
- `DELETE /api/parcels/:id` — Remove parcel and restore vehicle capacity if assigned *(Admin, Fleet Manager)*

### AMFOA & Algorithmic Optimization
- `POST /api/assignments/allocate/:parcelId` — Run 7-factor AMFOA optimization on a single pending parcel
- `POST /api/assignments/allocate-batch` — Drain min-heap priority queue and allocate all pending parcels
- `GET /api/assignments/parcel-breakdown/:parcelId` — Detailed factor breakdown and candidate rankings for a parcel
- `POST /api/assignments/optimize-load/:vehicleId` — 2D Knapsack load maximization recommendation
- `POST /api/assignments/apply-knapsack-load/:vehicleId` — 1-click atomic batch allocation of knapsack package to vehicle
- `POST /api/assignments/optimize-route/:vehicleId` — Held-Karp bitmask DP optimal delivery stop sequence
- `GET /api/assignments` — List historical assignments and AMFOA scores
- `GET /api/assignments/my-deliveries` — Retrieve active delivery schedule for the logged-in driver
- `PUT /api/assignments/:id/complete` — Mark assignment as delivered and decrement vehicle payload

### Locations & Network Graph
- `GET /api/locations` — Retrieve all 12 Ahmedabad hubs and 15 connecting road corridor edges

### Dashboard Analytics
- `GET /api/dashboard/summary` — Aggregate operational statistics (fleet readiness, pending load, delivery rate)
- `GET /api/dashboard/routes/:vehicleId` — Detailed transit path and assigned parcels for a specific vehicle

---

## 🗺️ Seeded Logistics Network (Ahmedabad Corridor)

The system includes pre-configured GIS coordinates and road edges representing Ahmedabad's industrial transit infrastructure:

| Hub ID | Location Hub Name | Type / Description |
|---|---|---|
| 1 | **Sanand GIDC Logistics Hub** | Heavy Industrial & Automobile Logistics Center |
| 2 | **Changodar Industrial Area** | Manufacturing & Freight Transshipment Depot |
| 3 | **Naroda GIDC Depot** | Eastern Industrial & Chemical Corridor Hub |
| 4 | **Aslali Transport Hub** | Central Inter-State Trucking Terminal |
| 5 | **Sarkhej Goods Terminal** | Southwestern Distribution & Warehousing Center |
| 6 | **SG Highway Distribution Hub** | Commercial Express Distribution Center |
| 7 | **Kalupur Central Railway Cargo** | Inter-Modal Rail-to-Road Cargo Hub |
| 8 | **Odhav Industrial Estate** | Machinery & Hardware Logistics Yard |
| 9 | **Vatva GIDC Phase IV** | Southern Manufacturing & Storage Yard |
| 10 | **Chandkheda North Center** | Northern Suburban FMCG Hub |
| 11 | **Bavla Highway Yard** | Agricultural & Agro-Chemical Logistics Center |
| 12 | **Maninagar Express Hub** | Southeastern Parcel Fulfillment Center |

---

## 🔒 Security & Best Practices

- **Password Hashing**: Passwords stored using `bcryptjs` with salt rounds.
- **JWT Authentication**: Secure stateless token authentication with expiration.
- **Database Transactions**: Multi-step assignment operations (updating vehicle load, changing parcel status, logging AMFOA breakdown) run within atomic PostgreSQL transactions (`BEGIN ... COMMIT / ROLLBACK`).
- **Input Sanitization**: Parameterized SQL queries prevent SQL injection across all endpoints.

---

## 📄 License

This project is licensed under the MIT License — see the LICENSE file for details.
