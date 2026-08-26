const { compareCandidates } = require('./candidateComparator');

function isHigherPriority(left, right) {
  return compareCandidates(left, right) < 0;
}

function siftDown(heap, startIndex) {
  let index = startIndex;
  while (true) {
    const leftChild = (index * 2) + 1;
    const rightChild = leftChild + 1;
    let highest = index;

    if (leftChild < heap.length && isHigherPriority(heap[leftChild], heap[highest])) {
      highest = leftChild;
    }
    if (rightChild < heap.length && isHigherPriority(heap[rightChild], heap[highest])) {
      highest = rightChild;
    }
    if (highest === index) {
      return;
    }

    [heap[index], heap[highest]] = [heap[highest], heap[index]];
    index = highest;
  }
}

function buildMaxHeap(candidates) {
  const heap = [...candidates];
  for (let index = Math.floor(heap.length / 2) - 1; index >= 0; index -= 1) {
    siftDown(heap, index);
  }
  return heap;
}

function extractMax(heap) {
  if (heap.length === 0) {
    return null;
  }

  const highest = heap[0];
  const last = heap.pop();
  if (heap.length > 0) {
    heap[0] = last;
    siftDown(heap, 0);
  }
  return highest;
}

function heapTopK(candidates, k) {
  const heap = buildMaxHeap(candidates);
  const limit = Math.max(0, Math.min(k, heap.length));
  const topCandidates = [];

  for (let index = 0; index < limit; index += 1) {
    topCandidates.push(extractMax(heap));
  }
  return topCandidates;
}

module.exports = { heapTopK };
