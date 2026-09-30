// AMFOA — Adaptive Multi-Constraint Fleet Optimization Algorithm
// Pipeline: capacity filter -> driver-hours filter -> Dijkstra distance scoring
// -> weighted multi-factor score -> GREEDY best-vehicle selection.
// A min-heap PRIORITY QUEUE orders the batch queue by urgency (deadline + priority).
const { dijkstra } = require('./graph');
const MinHeap = require('./priorityQueue');

const WEIGHTS = {
  distance: 0.25,
  capacity: 0.20,
  deadline: 0.20,
  fuelEfficiency: 0.10,
  driverHours: 0.10,
  vehicleHealth: 0.10,
  priority: 0.05,
};

// Maps value into [0,1] where LOWER raw value => HIGHER score (closer/lighter/fresher is better)
function normalize(value, min, max) {
  if (max === min) return 1;
  return Math.max(0, Math.min(1, 1 - (value - min) / (max - min)));
}

// Step 1: remove vehicles that physically cannot carry the parcel or are unavailable
function capacityFilter(vehicles, parcel) {
  return vehicles.filter((v) => {
    const remW = v.max_weight_kg - v.current_load_kg;
    const remV = v.max_volume_m3 - v.current_volume_m3;
    return remW >= parcel.weight_kg && remV >= parcel.volume_m3 && v.status === 'available';
  });
}

// Step 2: remove vehicles whose driver is unavailable or out of working hours
function driverAvailableFilter(vehicles, drivers) {
  const driverMap = new Map(drivers.map((d) => [d.id, d]));
  return vehicles.filter((v) => {
    const d = driverMap.get(v.driver_id);
    return d && d.availability && d.working_hours_today < d.max_working_hours;
  });
}

// Step 3: compute the multi-constraint optimization score for one vehicle/parcel pair
function computeScore(vehicle, parcel, graph, drivers, allDistances) {
  const driver = drivers.find((d) => d.id === vehicle.driver_id) || {};
  const distResult = dijkstra(graph, vehicle.current_location_id, parcel.pickup_location_id);
  const distance = distResult.distance === Infinity ? 9999 : distResult.distance;

  const distScore = normalize(distance, 0, allDistances.max || 100);
  const capacityScore = normalize(vehicle.current_load_kg, 0, vehicle.max_weight_kg);
  const hoursLeft = (new Date(parcel.deadline) - new Date()) / 36e5;
  const deadlineScore = normalize(hoursLeft, 0, 48);
  const fuelScore = normalize(1 / (vehicle.fuel_efficiency_kmpl || 1), 0, 1);
  const driverHoursScore = normalize(driver.working_hours_today || 0, 0, driver.max_working_hours || 8);
  const healthScore = normalize(100 - (vehicle.maintenance_score ?? 100), 0, 100);
  const priorityScore = normalize(parcel.priority, 1, 5);

  const score =
    WEIGHTS.distance * distScore +
    WEIGHTS.capacity * capacityScore +
    WEIGHTS.deadline * deadlineScore +
    WEIGHTS.fuelEfficiency * fuelScore +
    WEIGHTS.driverHours * driverHoursScore +
    WEIGHTS.vehicleHealth * healthScore +
    WEIGHTS.priority * priorityScore;

  return {
    vehicleId: vehicle.id,
    score: Number(score.toFixed(4)),
    breakdown: {
      distanceKm: Number(distance.toFixed(2)),
      distScore: Number(distScore.toFixed(3)),
      capacityScore: Number(capacityScore.toFixed(3)),
      deadlineScore: Number(deadlineScore.toFixed(3)),
      fuelScore: Number(fuelScore.toFixed(3)),
      driverHoursScore: Number(driverHoursScore.toFixed(3)),
      healthScore: Number(healthScore.toFixed(3)),
      priorityScore: Number(priorityScore.toFixed(3)),
    },
    routeToPickup: distResult.path,
  };
}

// Step 4: GREEDY selection — allocate ONE parcel to its best-scoring available vehicle
function allocateParcel(parcel, vehicles, drivers, graph) {
  let candidates = capacityFilter(vehicles, parcel);
  candidates = driverAvailableFilter(candidates, drivers);
  if (!candidates.length) return { success: false, reason: 'No vehicle satisfies capacity, availability or driver-hours constraints' };

  const distances = candidates
    .map((v) => dijkstra(graph, v.current_location_id, parcel.pickup_location_id).distance)
    .filter((d) => d !== Infinity);
  const allDistances = { max: distances.length ? Math.max(...distances) : 100 };

  const scored = candidates.map((v) => computeScore(v, parcel, graph, drivers, allDistances));
  scored.sort((a, b) => b.score - a.score); // greedy: highest score wins
  return { success: true, chosen: scored[0], allScores: scored };
}

// Batch mode: drain a MIN-HEAP priority queue ordered by urgency (deadline + priority),
// so the most time-critical parcels are optimized first. Vehicle loads accumulate across
// the batch, enabling multiple parcels per vehicle trip (up to remaining capacity).
function allocateBatch(parcels, vehicles, drivers, graph) {
  const pq = new MinHeap((a, b) => {
    const aUrgency = (new Date(a.deadline) - new Date()) + a.priority * 36e5;
    const bUrgency = (new Date(b.deadline) - new Date()) + b.priority * 36e5;
    return aUrgency - bUrgency;
  });
  parcels.forEach((p) => pq.push(p));

  const results = [];
  const workingVehicles = vehicles.map((v) => ({ ...v })); // clone so loads update within the batch

  while (!pq.isEmpty()) {
    const parcel = pq.pop();
    const result = allocateParcel(parcel, workingVehicles, drivers, graph);
    if (result.success) {
      const v = workingVehicles.find((v) => v.id === result.chosen.vehicleId);
      v.current_load_kg += parcel.weight_kg;
      v.current_volume_m3 += parcel.volume_m3;
    }
    results.push({ parcel, ...result });
  }
  return results;
}

module.exports = { allocateParcel, allocateBatch, capacityFilter, computeScore, WEIGHTS };
