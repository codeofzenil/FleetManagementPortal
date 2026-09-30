// Graph algorithms — Dijkstra (guaranteed shortest path) and A* (heuristic-accelerated)
const MinHeap = require('./priorityQueue');

// graph: { nodeId: [{ to, weight }] }
function dijkstra(graph, source, target) {
  const dist = new Map();
  const prev = new Map();
  const pq = new MinHeap((a, b) => a.dist - b.dist);

  dist.set(source, 0);
  pq.push({ node: source, dist: 0 });

  while (!pq.isEmpty()) {
    const { node, dist: d } = pq.pop();
    if (d > (dist.get(node) ?? Infinity)) continue;
    if (node === target) break;

    const neighbors = graph[node] || [];
    for (const edge of neighbors) {
      const alt = d + edge.weight;
      if (alt < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, node);
        pq.push({ node: edge.to, dist: alt });
      }
    }
  }

  if (!dist.has(target)) return { distance: source === target ? 0 : Infinity, path: source === target ? [source] : [] };

  const path = [];
  let cur = target;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return { distance: dist.get(target), path };
}

function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// A* — requires a coords map { nodeId: {lat,lng} } for the heuristic
function aStar(graph, coords, source, target) {
  const g = new Map([[source, 0]]);
  const prev = new Map();
  const pq = new MinHeap((a, b) => a.f - b.f);
  pq.push({ node: source, f: haversine(coords[source], coords[target]) });
  const visited = new Set();

  while (!pq.isEmpty()) {
    const { node } = pq.pop();
    if (node === target) break;
    if (visited.has(node)) continue;
    visited.add(node);

    for (const edge of (graph[node] || [])) {
      const tentative = g.get(node) + edge.weight;
      if (tentative < (g.get(edge.to) ?? Infinity)) {
        g.set(edge.to, tentative);
        prev.set(edge.to, node);
        const f = tentative + haversine(coords[edge.to], coords[target]);
        pq.push({ node: edge.to, f });
      }
    }
  }

  if (!g.has(target)) return { distance: Infinity, path: [] };
  const path = [];
  let cur = target;
  while (cur !== undefined) { path.unshift(cur); cur = prev.get(cur); }
  return { distance: g.get(target), path };
}

module.exports = { dijkstra, aStar, haversine };
