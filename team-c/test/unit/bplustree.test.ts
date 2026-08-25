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
    const tree = new BPlusTree<number, string>(4); // order 4 (min keys for leaf = 2, except root)

    // Insert keys: 10, 20, 30, 40, 50, 60
    for (let i = 10; i <= 60; i += 10) {
      tree.insert(i, `rec${i}`);
    }

    // Verify tree is split into internal nodes
    expect(tree.getRoot().isLeaf).toBe(false);

    // Delete keys to trigger underflow & borrowing/merging
    expect(tree.delete(60)).toBe(true);
    expect(tree.search(60)).toBeUndefined();

    // Delete 50 to force underflow and sibling borrowing or merging
    expect(tree.delete(50)).toBe(true);
    expect(tree.search(50)).toBeUndefined();

    // Delete 40 to force merging nodes
    expect(tree.delete(40)).toBe(true);
    expect(tree.search(40)).toBeUndefined();

    // Verify remaining keys are intact and retrievable
    expect(tree.search(10)).toEqual(['rec10']);
    expect(tree.search(20)).toEqual(['rec20']);
    expect(tree.search(30)).toEqual(['rec30']);
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
