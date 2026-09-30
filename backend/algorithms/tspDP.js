// Multi-stop route sequencing:
//   - Held-Karp bitmask DP gives the EXACT optimal order for <=12 stops (2^n * n^2).
//   - Falls back to a nearest-neighbor greedy heuristic beyond that (DP becomes infeasible).
const { dijkstra } = require('./graph');

function buildDistanceMatrix(graph, nodes) {
  const n = nodes.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(Infinity));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      matrix[i][j] = i === j ? 0 : dijkstra(graph, nodes[i], nodes[j]).distance;
    }
  }
  return matrix;
}

function heldKarp(matrix) {
  const n = matrix.length;
  if (n <= 1) return { order: [0], cost: 0 };
  const FULL = (1 << n) - 1;
  const dp = Array.from({ length: 1 << n }, () => new Array(n).fill(Infinity));
  const parent = Array.from({ length: 1 << n }, () => new Array(n).fill(-1));
  dp[1][0] = 0; // start fixed at stop 0 (vehicle's current location)

  for (let mask = 1; mask <= FULL; mask++) {
    if (!(mask & 1)) continue;
    for (let u = 0; u < n; u++) {
      if (!(mask & (1 << u)) || dp[mask][u] === Infinity) continue;
      for (let v = 0; v < n; v++) {
        if (mask & (1 << v)) continue;
        const next = mask | (1 << v);
        const cost = dp[mask][u] + matrix[u][v];
        if (cost < dp[next][v]) {
          dp[next][v] = cost;
          parent[next][v] = u;
        }
      }
    }
  }

  let best = Infinity, last = -1;
  for (let u = 1; u < n; u++) if (dp[FULL][u] < best) { best = dp[FULL][u]; last = u; }

  const order = [];
  let mask = FULL, cur = last;
  while (cur !== -1) {
    order.unshift(cur);
    const p = parent[mask][cur];
    mask ^= (1 << cur);
    cur = p;
  }
  return { order, cost: best };
}

function nearestNeighbor(matrix) {
  const n = matrix.length;
  const visited = new Array(n).fill(false);
  visited[0] = true;
  const order = [0];
  let cost = 0, cur = 0;
  for (let step = 1; step < n; step++) {
    let next = -1, best = Infinity;
    for (let v = 0; v < n; v++) {
      if (!visited[v] && matrix[cur][v] < best) { best = matrix[cur][v]; next = v; }
    }
    visited[next] = true;
    order.push(next);
    cost += best;
    cur = next;
  }
  return { order, cost };
}

// stops: array of location node ids; stops[0] is fixed as the vehicle's current location
function optimizeStopOrder(graph, stops) {
  const matrix = buildDistanceMatrix(graph, stops);
  const useExact = stops.length <= 12;
  const result = useExact ? heldKarp(matrix) : nearestNeighbor(matrix);
  return {
    orderedStops: result.order.map((i) => stops[i]),
    totalDistanceKm: Number(result.cost.toFixed(2)),
    method: useExact ? 'Held-Karp DP (optimal)' : 'Nearest Neighbor (heuristic, >12 stops)',
  };
}

module.exports = { optimizeStopOrder, buildDistanceMatrix, heldKarp, nearestNeighbor };
