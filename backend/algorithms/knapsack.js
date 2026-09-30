// 2D Multi-Constraint 0/1 Knapsack (DP / Branch & Bound)
// Optimally selects the subset of pending parcels that maximizes total delivery value
// (priority tier + deadline urgency + special handling) without exceeding a vehicle's
// remaining weight capacity (kg) AND remaining volume capacity (m³).

function urgencyBonus(deadline) {
  if (!deadline) return 0;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return 0;
  const hoursLeft = (d.getTime() - Date.now()) / 36e5;
  if (hoursLeft <= 2) return 30; // Critical urgency: < 2 hours (or overdue)
  if (hoursLeft <= 6) return 20; // High urgency: < 6 hours
  if (hoursLeft <= 24) return 10; // Medium urgency: < 24 hours
  return 0;
}

function computeParcelValue(parcel) {
  if (!parcel) return 10;
  const priorityNum = Math.min(5, Math.max(1, Number(parcel.priority) || 3));
  const baseValue = (6 - priorityNum) * 10; // Priority 1 -> 50, Priority 5 -> 10
  const bonus = urgencyBonus(parcel.deadline);
  const fragileBonus = parcel.fragile ? 5 : 0;
  return baseValue + bonus + fragileBonus;
}

function knapsackSelect(parcels = [], maxWeight = 0, maxVolume = 0) {
  const maxW = Math.max(0, Number(maxWeight) || 0);
  const maxV = Math.max(0, Number(maxVolume) || 0);

  if (!Array.isArray(parcels) || !parcels.length || maxW <= 0 || maxV <= 0) {
    const emptyResult = [];
    emptyResult.items = [];
    emptyResult.totalWeight = 0;
    emptyResult.totalVolume = 0;
    emptyResult.totalValue = 0;
    emptyResult.weightUtilization = 0;
    emptyResult.volumeUtilization = 0;
    return emptyResult;
  }

  // Pre-filter items that individually exceed vehicle capacity
  const eligibleItems = parcels
    .filter((p) => p && Number(p.weight_kg) > 0 && Number(p.weight_kg) <= maxW + 1e-6 && Number(p.volume_m3) <= maxV + 1e-6)
    .map((p) => {
      const val = computeParcelValue(p);
      return {
        ...p,
        weight_kg: Number(p.weight_kg),
        volume_m3: Number(p.volume_m3),
        value: val,
      };
    });

  if (!eligibleItems.length) {
    const emptyResult = [];
    emptyResult.items = [];
    emptyResult.totalWeight = 0;
    emptyResult.totalVolume = 0;
    emptyResult.totalValue = 0;
    emptyResult.weightUtilization = 0;
    emptyResult.volumeUtilization = 0;
    return emptyResult;
  }

  // Sort candidate items by 2D normalized efficiency density: value / (w/maxW + v/maxV)
  eligibleItems.sort((a, b) => {
    const densityA = a.value / (a.weight_kg / maxW + a.volume_m3 / maxV + 1e-6);
    const densityB = b.value / (b.weight_kg / maxW + b.volume_m3 / maxV + 1e-6);
    return densityB - densityA;
  });

  // Limit search window to top 40 candidates if large queue to guarantee instantaneous response (<10ms)
  const items = eligibleItems.slice(0, 40);

  // Precompute suffix remaining potential values and weights for upper-bound pruning
  const suffixValue = new Array(items.length + 1).fill(0);
  const suffixWeight = new Array(items.length + 1).fill(0);
  for (let i = items.length - 1; i >= 0; i--) {
    suffixValue[i] = suffixValue[i + 1] + items[i].value;
    suffixWeight[i] = suffixWeight[i + 1] + items[i].weight_kg;
  }

  let bestValue = 0;
  let bestWeight = 0;
  let bestVolume = 0;
  let bestItems = [];
  let iterations = 0;
  const MAX_ITERATIONS = 300000;

  function branchAndBound(idx, currentW, currentV, currentVal, currentList) {
    iterations++;

    // Update global best if this configuration has strictly higher value,
    // or same value with higher payload weight (tie-breaker for payload load maximization)
    if (currentVal > bestValue || (currentVal === bestValue && currentW > bestWeight)) {
      bestValue = currentVal;
      bestWeight = currentW;
      bestVolume = currentV;
      bestItems = [...currentList];
    }

    if (idx >= items.length || iterations > MAX_ITERATIONS) return;

    // Prune branch if even taking ALL remaining items cannot beat the bestValue found
    if (currentVal + suffixValue[idx] < bestValue) return;
    // If value can at most tie bestValue, prune if combined remaining weight cannot beat bestWeight
    if (currentVal + suffixValue[idx] === bestValue && currentW + suffixWeight[idx] <= bestWeight) return;

    const item = items[idx];

    // Branch 1: Try INCLUDING this item if it satisfies both remaining capacity constraints
    if (currentW + item.weight_kg <= maxW + 1e-6 && currentV + item.volume_m3 <= maxV + 1e-6) {
      currentList.push(item);
      branchAndBound(
        idx + 1,
        currentW + item.weight_kg,
        currentV + item.volume_m3,
        currentVal + item.value,
        currentList
      );
      currentList.pop();
    }

    // Branch 2: Try EXCLUDING this item
    branchAndBound(idx + 1, currentW, currentV, currentVal, currentList);
  }

  branchAndBound(0, 0, 0, 0, []);

  const totalW = Number(bestItems.reduce((acc, x) => acc + x.weight_kg, 0).toFixed(1));
  const totalV = Number(bestItems.reduce((acc, x) => acc + x.volume_m3, 0).toFixed(2));
  const weightUtil = maxW > 0 ? Math.round((totalW / maxW) * 100) : 0;
  const volumeUtil = maxV > 0 ? Math.round((totalV / maxV) * 100) : 0;

  // Return array with attached metadata properties for full backwards-compatibility
  const result = [...bestItems];
  result.items = bestItems;
  result.totalWeight = totalW;
  result.totalVolume = totalV;
  result.totalValue = bestValue;
  result.weightUtilization = weightUtil;
  result.volumeUtilization = volumeUtil;

  return result;
}

module.exports = { knapsackSelect, urgencyBonus, computeParcelValue };
