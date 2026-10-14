import { compareCandidates } from './candidateComparator';
import type { ComparableCandidate } from '../types';

function merge<T extends ComparableCandidate>(left: T[], right: T[]): T[] {
  const merged: T[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (compareCandidates(left[leftIndex], right[rightIndex]) <= 0) merged.push(left[leftIndex++]);
    else merged.push(right[rightIndex++]);
  }
  return merged.concat(left.slice(leftIndex), right.slice(rightIndex));
}

export function mergeSortCandidates<T extends ComparableCandidate>(candidates: T[]): T[] {
  if (candidates.length <= 1) return [...candidates];
  const middle = Math.floor(candidates.length / 2);
  return merge(mergeSortCandidates(candidates.slice(0, middle)), mergeSortCandidates(candidates.slice(middle)));
}
