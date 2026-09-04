import { describe, test, expect } from '@jest/globals';
import { BPlusTree, BPlusInternalNode, BPlusLeafNode } from '../../src/storage/indexes/bplustree.js';

describe('M1 - Custom B+Tree Index Unit Tests', () => {
  test('forces a B+Tree split (node overflow and root split)', () => {
    // Tree of order 3 (max keys per node = 2 before split)
    const tree = new BPlusTree<number, string>(3);

    // Initial root is leaf
    expect(tree.getRoot().isLeaf).toBe(true);

    tree.insert(10, 'rec10');
    tree.insert(20, 'rec20');
    expect(tree.getRoot().isLeaf).toBe(true);
    expect(tree.getRoot().keys).toEqual([10, 20]);

    // Inserting 30 forces leaf split and creates an internal root node
    tree.insert(30, 'rec30');
    expect(tree.getRoot().isLeaf).toBe(false);

    const rootInternal = tree.getRoot() as BPlusInternalNode<number, string>;
    expect(rootInternal.keys).toEqual([20]);
    expect(rootInternal.children.length).toBe(2);

    const leftLeaf = rootInternal.children[0] as BPlusLeafNode<number, string>;
    const rightLeaf = rootInternal.children[1] as BPlusLeafNode<number, string>;

    expect(leftLeaf.isLeaf).toBe(true);
    expect(rightLeaf.isLeaf).toBe(true);
    expect(leftLeaf.keys).toEqual([10]);
    expect(rightLeaf.keys).toEqual([20, 30]);

    // Verify leaf-to-leaf linkage
    expect(leftLeaf.next).toBe(rightLeaf);
    expect(rightLeaf.prev).toBe(leftLeaf);

    // Verify search works across split tree
    expect(tree.search(10)).toEqual(['rec10']);
    expect(tree.search(20)).toEqual(['rec20']);
    expect(tree.search(30)).toEqual(['rec30']);
  });

  test('forces a B+Tree underflow, borrowing, and node merging on delete', () => {
    const tree = new BPlusTree<number, string>(3); // order 3 (max keys per node = 2, min keys = 1)

    // Insert keys: 10, 20, 30, 40
    tree.insert(10, 'rec10');
    tree.insert(20, 'rec20');
    tree.insert(30, 'rec30');
    tree.insert(40, 'rec40');

    // Verify tree split into internal root with leaves
    expect(tree.getRoot().isLeaf).toBe(false);

    // Delete 40 (leaves leaf with 30)
    expect(tree.delete(40)).toBe(true);
    expect(tree.search(40)).toBeUndefined();

    // Delete 30 (causes underflow on leaf, triggers merge with left sibling)
    expect(tree.delete(30)).toBe(true);
    expect(tree.search(30)).toBeUndefined();

    // Delete 20 (causes underflow and collapses root back to leaf)
    expect(tree.delete(20)).toBe(true);
    expect(tree.search(20)).toBeUndefined();

    // Root collapsed back to single leaf containing only 10
    expect(tree.getRoot().isLeaf).toBe(true);
    expect(tree.getRoot().keys).toEqual([10]);
    expect(tree.search(10)).toEqual(['rec10']);
  });

  test('range query traverses linked leaves correctly', () => {
    const tree = new BPlusTree<number, string>(3);

    const data = [15, 5, 25, 10, 30, 20, 35, 40];
    for (const val of data) {
      tree.insert(val, `id_${val}`);
    }

    // Range query [10, 30]
    const rangeResults = tree.rangeQuery(10, 30);
    expect(rangeResults).toEqual(['id_10', 'id_15', 'id_20', 'id_25', 'id_30']);

    // Exclusive upper range [10, 30)
    const rangeExclusive = tree.rangeQuery(10, 30, true, false);
    expect(rangeExclusive).toEqual(['id_10', 'id_15', 'id_20', 'id_25']);
  });
});
