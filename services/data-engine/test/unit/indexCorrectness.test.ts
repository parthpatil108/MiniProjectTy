import { describe, test, expect } from '@jest/globals';
import { BPlusTree } from '../../src/storage/indexes/bplustree.js';
import { HashIndex } from '../../src/storage/indexes/hashIndex.js';

describe('Index Correctness — Property-Style Randomized Tests', () => {
  test('HashIndex matches reference JavaScript Map over 500 randomized operations', () => {
    const hashIndex = new HashIndex<string, string>();
    const referenceMap = new Map<string, string>();

    const keys = Array.from({ length: 100 }, (_, i) => `key_${i}`);

    for (let op = 0; op < 500; op++) {
      const action = Math.floor(Math.random() * 3);
      const key = keys[Math.floor(Math.random() * keys.length)];
      const val = `val_${Math.random()}`;

      if (action === 0) {
        // Insert / Put
        hashIndex.put(key, val);
        referenceMap.set(key, val);
      } else if (action === 1) {
        // Lookup / Search
        const actual = hashIndex.get(key);
        const expected = referenceMap.get(key);
        expect(actual).toBe(expected);
      } else {
        // Delete
        const actualRemoved = hashIndex.remove(key);
        const expectedRemoved = referenceMap.delete(key);
        expect(actualRemoved).toBe(expectedRemoved);
      }
    }

    // Final verification of all entries
    for (const [k, v] of referenceMap.entries()) {
      expect(hashIndex.get(k)).toBe(v);
    }
  });

  test('BPlusTree matches reference sorted array for point and range queries', () => {
    const bplusTree = new BPlusTree<number, string>(4);
    const referenceData = new Map<number, string>();

    // Insert 150 randomized unique numeric keys
    const insertedNumbers = new Set<number>();
    while (insertedNumbers.size < 150) {
      const num = Math.floor(Math.random() * 1000);
      insertedNumbers.add(num);
    }

    for (const num of insertedNumbers) {
      const val = `val_for_${num}`;
      bplusTree.insert(num, val);
      referenceData.set(num, val);
    }

    // 1. Point lookup verification
    for (const [k, v] of referenceData.entries()) {
      const results = bplusTree.search(k);
      expect(results).toContain(v);
    }

    // 2. Randomized Range Queries
    for (let i = 0; i < 50; i++) {
      const low = Math.floor(Math.random() * 500);
      const high = low + Math.floor(Math.random() * 400);

      const actualRange = bplusTree.rangeQuery(low, high, true, true);

      // Reference range
      const expectedRange = Array.from(referenceData.entries())
        .filter(([k]) => k >= low && k <= high)
        .sort((a, b) => a[0] - b[0])
        .map(([_, v]) => v);

      expect(actualRange.sort()).toEqual(expectedRange.sort());
    }
  });
});
