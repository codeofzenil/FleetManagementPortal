// Merge Sort — O(n log n) stable sort, used to order deliveries by deadline/priority/distance
function mergeSort(arr, compare) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid), compare);
  const right = mergeSort(arr.slice(mid), compare);
  return merge(left, right, compare);
}

function merge(left, right, compare) {
  const result = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (compare(left[i], right[j]) <= 0) result.push(left[i++]);
    else result.push(right[j++]);
  }
  return result.concat(left.slice(i)).concat(right.slice(j));
}

const byDeadline = (a, b) => new Date(a.deadline) - new Date(b.deadline);
const byPriority = (a, b) => a.priority - b.priority;

module.exports = { mergeSort, byDeadline, byPriority };
