import { compareCandidates } from './candidateComparator';
import type { CandidateScore } from '../types';

function isHigherPriority(left: CandidateScore, right: CandidateScore): boolean { return compareCandidates(left, right) < 0; }
function siftDown(heap: CandidateScore[], startIndex: number): void {
  let index = startIndex;
  while (true) {
    const leftChild = (index * 2) + 1;
    const rightChild = leftChild + 1;
    let highest = index;
    if (leftChild < heap.length && isHigherPriority(heap[leftChild], heap[highest])) highest = leftChild;
    if (rightChild < heap.length && isHigherPriority(heap[rightChild], heap[highest])) highest = rightChild;
    if (highest === index) return;
    [heap[index], heap[highest]] = [heap[highest], heap[index]];
    index = highest;
  }
}
function buildMaxHeap(candidates: CandidateScore[]): CandidateScore[] {
  const heap = [...candidates];
  for (let index = Math.floor(heap.length / 2) - 1; index >= 0; index -= 1) siftDown(heap, index);
  return heap;
}
function extractMax(heap: CandidateScore[]): CandidateScore | null {
  if (heap.length === 0) return null;
  const highest = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) { heap[0] = last; siftDown(heap, 0); }
  return highest;
}
export function heapTopK(candidates: CandidateScore[], k: number): CandidateScore[] {
  const heap = buildMaxHeap(candidates);
  const limit = Math.max(0, Math.min(k, heap.length));
  const topCandidates: CandidateScore[] = [];
  for (let index = 0; index < limit; index += 1) topCandidates.push(extractMax(heap)!);
  return topCandidates;
}
