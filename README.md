# STMPAS — Smart Transportation Management & Parcel Allocation System

Full-stack implementation of the SRD: React + Node/Express + PostgreSQL, with a real
**Adaptive Multi-Constraint Fleet Optimization Algorithm (AMFOA)** engine implementing the
DAA concepts from Section 10 of the document.

## 1. Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 (Vite) + Tailwind CSS + React Router + Axios + Leaflet (OpenStreetMap) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT + bcrypt, role-based (`admin`, `fleet_manager`, `driver`, `customer`) |

## 2. Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Database
```bash
createdb stmpas
psql -d stmpas -f backend/db/schema.sql
```

### Backend
```bash
cd backend
cp .env.example .env      # edit PG* credentials and JWT_SECRET
npm install
npm run seed               # loads demo locations, road graph, users, vehicles, parcels
npm run dev                 # http://localhost:5000
```

### Frontend
```bash
cd frontend
cp .env.example .env       # VITE_API_URL, defaults to http://localhost:5000/api
npm install
npm run dev                 # http://localhost:3000
```

### Demo logins (password: `password123`)
| Role | Email | Details |
|---|---|---|
| Admin | admin@stmpas.com | Full system control, analytics, driver/vehicle/parcel CRUD, AMFOA score breakdown |
| Fleet Manager | fleet@stmpas.com | Real-time dispatch, live map, parcel CRUD, Knapsack & Held-Karp DP route solvers |
| Drivers | rajesh@stmpas.com / vikram@stmpas.com / hitesh@stmpas.com | Active deliveries, AMFOA routes, delivery completion |

## 3. Where each DAA concept lives

| SRD Section 10 concept | File | How it's used |
|---|---|---|
| Greedy Algorithm | `backend/algorithms/amfoa.js` | Highest-scoring vehicle wins each allocation |
| Heap / Priority Queue | `backend/algorithms/priorityQueue.js` | Min-heap orders the batch queue by deadline+priority; also powers Dijkstra/A* |
| Graph Algorithms + Dijkstra | `backend/algorithms/graph.js` | Shortest path on the road-network graph (`locations` + `road_edges` tables) |
| A* Search | `backend/algorithms/graph.js` (`aStar`) | Heuristic-accelerated variant using haversine distance; available for larger graphs |
| Knapsack (DP) | `backend/algorithms/knapsack.js` | 0/1 knapsack picks the best subset of pending parcels for one vehicle's remaining capacity — wired to `POST /assignments/optimize-load/:vehicleId` and the Fleet Manager UI |
| Sorting | `backend/algorithms/mergeSort.js` | Custom merge sort orders the parcel list by deadline (`GET /parcels`) |
| Dynamic Programming (multi-stop) | `backend/algorithms/tspDP.js` | Held-Karp bitmask DP gives the exact optimal stop order for ≤12 stops (falls back to nearest-neighbor beyond that) — wired to `POST /assignments/optimize-route/:vehicleId` |

`amfoa.js` is the orchestrator (Section 7–8 & 11 of the SRD): capacity filter → driver-hours
filter → Dijkstra distance scoring → seven-factor weighted score → greedy selection.
`allocateBatch` drains the priority queue so the most urgent parcels are optimized first,
and vehicle loads accumulate across a batch run so one vehicle can legitimately receive
multiple parcels up to its capacity — matching the knapsack "maximize loading" idea.

## 4. API summary

```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/vehicles                       POST /api/vehicles         PUT/DELETE /api/vehicles/:id
GET    /api/vehicles/:id/score-breakdown   ← AMFOA operational score & readiness breakdown
GET    /api/drivers                        POST /api/drivers          PUT/DELETE /api/drivers/:id
GET    /api/parcels                        POST /api/parcels          PUT/DELETE /api/parcels/:id
GET    /api/locations                      ← Ahmedabad logistics hubs & road edges

POST   /api/assignments/allocate/:parcelId       ← single-parcel AMFOA run
POST   /api/assignments/allocate-batch           ← priority-queue batch AMFOA run
GET    /api/assignments/parcel-breakdown/:id     ← 7-factor AMFOA scoring breakdown & candidate rankings
POST   /api/assignments/optimize-load/:vehicleId ← knapsack DP load suggestion
POST   /api/assignments/optimize-route/:vehicleId← Held-Karp DP multi-stop route
GET    /api/assignments                          GET /api/assignments/my-deliveries (driver)
PUT    /api/assignments/:id/complete             (driver marks delivered)

GET    /api/dashboard/summary
GET    /api/dashboard/routes/:vehicleId
```

All routes except `/auth/*` require `Authorization: Bearer <token>`.

## 5. Known simplifications (documented, not accidental)

- Vehicle GPS positions are the seeded `locations` coordinates, not a live GPS feed —
  swap in a real telemetry source by updating `vehicles.current_location_id` (or adding
  live lat/lng columns) and the map updates automatically.
- Driver `working_hours_today` and vehicle `status` are updated manually via the
  PUT endpoints; a production system would tick these from real check-in/check-out events.
- Estimated route time is a flat `distance × 2 min/km` placeholder — replace with a real
  speed model or traffic API when available.
- QR-based parcel scanning, invoices, and push notifications (SRD Sections 5–6) are
  represented by their DB tables (`notifications`, parcel `status`) but don't yet have
  dedicated endpoints — straightforward to add following the existing route patterns.

## 6. Extending

- **Customer portal**: the `customers` table and parcel-creation endpoint already exist;
  add a `/customer` React route + tracking view following the Driver dashboard as a template.
- **Reports (Section 13)**: aggregate queries similar to `dashboard.routes.js` `/summary`.
- **Benchmarking (Section 18)**: `amfoa.js` exports `computeScore`/`allocateParcel`
  directly, so a script can run First-Available / Nearest / Highest-Capacity strategies
  against the same seeded data and diff the results for your academic comparison.
