const { compareCandidates } = require('./candidateComparator');

function merge(left, right) {
  const merged = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (compareCandidates(left[leftIndex], right[rightIndex]) <= 0) {
      merged.push(left[leftIndex]);
      leftIndex += 1;
    } else {
      merged.push(right[rightIndex]);
      rightIndex += 1;
    }
  }

  return merged.concat(left.slice(leftIndex), right.slice(rightIndex));
}

function mergeSortCandidates(candidates) {
  if (candidates.length <= 1) {
    return [...candidates];
  }

  const middle = Math.floor(candidates.length / 2);
  return merge(
    mergeSortCandidates(candidates.slice(0, middle)),
    mergeSortCandidates(candidates.slice(middle))
  );
}

module.exports = { mergeSortCandidates };
