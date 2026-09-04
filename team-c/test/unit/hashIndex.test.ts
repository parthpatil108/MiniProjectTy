import { describe, test, expect, beforeEach } from '@jest/globals';
import { HashIndex } from '../../src/storage/indexes/hashIndex.js';

describe('M1 - Custom Hash Index Unit Tests', () => {
  let hashIndex: HashIndex<string, string>;

  beforeEach(() => {
    // Initial capacity 4, threshold 0.75 -> resizes at 3 items
    hashIndex = new HashIndex<string, string>(4, 0.75);
  });

  test('forces a hash collision and confirms both keys are retrievable', () => {
    // Capacity 16 to avoid resize during collision test
    const hIndex = new HashIndex<string, string>(16, 0.75);

    // Find two distinct keys that hash to the exact same bucket index
    let k1 = 'key_0';
    let k2 = '';
    const hash1 = hIndex.hash(k1);

    for (let i = 1; i < 1000; i++) {
      const candidate = `key_${i}`;
      if (hIndex.hash(candidate) === hash1) {
        k2 = candidate;
        break;
      }
    }

    expect(k2).not.toBe('');
    expect(hIndex.hash(k1)).toBe(hIndex.hash(k2));

    // Insert both colliding keys
    hIndex.put(k1, 'value1');
    hIndex.put(k2, 'value2');

    // Confirm bucket chain holds both entries
    const bucket = hIndex.getBuckets()[hash1];
    expect(bucket.length).toBe(2);
    expect(bucket.map((b) => b.key)).toEqual(expect.arrayContaining([k1, k2]));

    // Confirm both keys are retrievable independently
    expect(hIndex.get(k1)).toBe('value1');
    expect(hIndex.get(k2)).toBe('value2');
    expect(hIndex.has(k1)).toBe(true);
    expect(hIndex.has(k2)).toBe(true);

    // Remove first key and verify second key remains intact in collision chain
    expect(hIndex.remove(k1)).toBe(true);
    expect(hIndex.get(k1)).toBeUndefined();
    expect(hIndex.get(k2)).toBe('value2');
  });

  test('forces a hash resize when load factor threshold is crossed', () => {
    const initialCapacity = hashIndex.getCapacity();
    expect(initialCapacity).toBe(4);

    // Load factor threshold is 0.75, capacity 4 -> resizes when size reaching 3
    hashIndex.put('k1', 'val1');
    hashIndex.put('k2', 'val2');
    expect(hashIndex.getCapacity()).toBe(4);

    // Trigger resize by adding 3rd element
    hashIndex.put('k3', 'val3');
    expect(hashIndex.getCapacity()).toBe(8);

    // Add more to trigger another resize (at 6/8 = 0.75 -> 16)
    hashIndex.put('k4', 'val4');
    hashIndex.put('k5', 'val5');
    hashIndex.put('k6', 'val6');
    expect(hashIndex.getCapacity()).toBe(16);

    // Confirm all previously inserted keys are still retrievable post-rehash
    expect(hashIndex.get('k1')).toBe('val1');
    expect(hashIndex.get('k2')).toBe('val2');
    expect(hashIndex.get('k3')).toBe('val3');
    expect(hashIndex.get('k4')).toBe('val4');
    expect(hashIndex.get('k5')).toBe('val5');
    expect(hashIndex.get('k6')).toBe('val6');
    expect(hashIndex.getSize()).toBe(6);
  });
});
