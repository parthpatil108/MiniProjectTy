export abstract class BPlusNode<K, V> {
  public isLeaf: boolean;
  public parent: BPlusInternalNode<K, V> | null = null;
  public keys: K[] = [];

  constructor(isLeaf: boolean) {
    this.isLeaf = isLeaf;
  }
}

export class BPlusLeafNode<K, V> extends BPlusNode<K, V> {
  public values: V[][] = []; // Each key maps to an array of values (to handle duplicate index keys)
  public next: BPlusLeafNode<K, V> | null = null;
  public prev: BPlusLeafNode<K, V> | null = null;

  constructor() {
    super(true);
  }
}

export class BPlusInternalNode<K, V> extends BPlusNode<K, V> {
  public children: BPlusNode<K, V>[] = [];

  constructor() {
    super(false);
  }
}

export class BPlusTree<K = any, V = any> {
  private root: BPlusNode<K, V>;
  private order: number;

  constructor(order: number = 4) {
    if (order < 3) {
      throw new Error('B+Tree order must be at least 3');
    }
    this.order = order;
    this.root = new BPlusLeafNode<K, V>();
  }

  public getOrder(): number {
    return this.order;
  }

  public getRoot(): BPlusNode<K, V> {
    return this.root;
  }

  /**
   * Search for all values associated with an exact key.
   */
  public search(key: K): V[] | undefined {
    const leaf = this.findLeafNode(key);
    for (let i = 0; i < leaf.keys.length; i++) {
      if (this.compareKeys(leaf.keys[i], key) === 0) {
        return [...leaf.values[i]];
      }
    }
    return undefined;
  }

  /**
   * Insert a key-value pair into the B+Tree.
   */
  public insert(key: K, value: V): void {
    const leaf = this.findLeafNode(key);

    let idx = 0;
    while (idx < leaf.keys.length && this.compareKeys(leaf.keys[idx], key) < 0) {
      idx++;
    }

    if (idx < leaf.keys.length && this.compareKeys(leaf.keys[idx], key) === 0) {
      // Key already exists, append value if not present
      if (!leaf.values[idx].includes(value)) {
        leaf.values[idx].push(value);
      }
      return;
    }

    // Insert key and value array
    leaf.keys.splice(idx, 0, key);
    leaf.values.splice(idx, 0, [value]);

    // Check for overflow
    if (leaf.keys.length >= this.order) {
      this.splitLeafNode(leaf);
    }
  }

  /**
   * Delete a key (or specific value under key) from the B+Tree.
   */
  public delete(key: K, value?: V): boolean {
    const leaf = this.findLeafNode(key);
    let keyIndex = -1;

    for (let i = 0; i < leaf.keys.length; i++) {
      if (this.compareKeys(leaf.keys[i], key) === 0) {
        keyIndex = i;
        break;
      }
    }

    if (keyIndex === -1) {
      return false; // Key not found
    }

    if (value !== undefined) {
      const valIdx = leaf.values[keyIndex].indexOf(value);
      if (valIdx !== -1) {
        leaf.values[keyIndex].splice(valIdx, 1);
      }
      if (leaf.values[keyIndex].length > 0) {
        return true; // Still has other values for this key
      }
    }

    // Remove key and value array from leaf
    leaf.keys.splice(keyIndex, 1);
    leaf.values.splice(keyIndex, 1);

    // Check underflow
    this.handleUnderflow(leaf);
    return true;
  }

  /**
   * Perform a range query [low, high].
   */
  public rangeQuery(
    low: K,
    high: K,
    lowInclusive: boolean = true,
    highInclusive: boolean = true
  ): V[] {
    const results: V[] = [];
    let leaf: BPlusLeafNode<K, V> | null = this.findLeafNode(low);

    while (leaf !== null) {
      for (let i = 0; i < leaf.keys.length; i++) {
        const k = leaf.keys[i];
        const cmpLow = this.compareKeys(k, low);
        const cmpHigh = this.compareKeys(k, high);

        const satisfiesLow = lowInclusive ? cmpLow >= 0 : cmpLow > 0;
        const satisfiesHigh = highInclusive ? cmpHigh <= 0 : cmpHigh < 0;

        if (cmpHigh > 0) {
          return results; // Past upper bound
        }

        if (satisfiesLow && satisfiesHigh) {
          results.push(...leaf.values[i]);
        }
      }
      leaf = leaf.next;
    }

    return results;
  }

  /**
   * Helper to find leaf node for a given key.
   */
  private findLeafNode(key: K): BPlusLeafNode<K, V> {
    let curr = this.root;
    while (!curr.isLeaf) {
      const internal = curr as BPlusInternalNode<K, V>;
      let idx = 0;
      while (
        idx < internal.keys.length &&
        this.compareKeys(key, internal.keys[idx]) >= 0
      ) {
        idx++;
      }
      curr = internal.children[idx];
    }
    return curr as BPlusLeafNode<K, V>;
  }

  /**
   * Split a leaf node that has exceeded max keys.
   */
  private splitLeafNode(leaf: BPlusLeafNode<K, V>): void {
    const mid = Math.floor(leaf.keys.length / 2);

    const rightLeaf = new BPlusLeafNode<K, V>();
    rightLeaf.keys = leaf.keys.splice(mid);
    rightLeaf.values = leaf.values.splice(mid);

    rightLeaf.next = leaf.next;
    if (leaf.next) {
      leaf.next.prev = rightLeaf;
    }
    leaf.next = rightLeaf;
    rightLeaf.prev = leaf;

    const promotedKey = rightLeaf.keys[0];

    if (leaf.parent === null) {
      // Split root
      const newRoot = new BPlusInternalNode<K, V>();
      newRoot.keys = [promotedKey];
      newRoot.children = [leaf, rightLeaf];
      leaf.parent = newRoot;
      rightLeaf.parent = newRoot;
      this.root = newRoot;
    } else {
      rightLeaf.parent = leaf.parent;
      this.insertIntoParent(leaf.parent, promotedKey, rightLeaf);
    }
  }

  /**
   * Insert a promoted key and child into an internal parent node.
   */
  private insertIntoParent(
    parent: BPlusInternalNode<K, V>,
    key: K,
    rightChild: BPlusNode<K, V>
  ): void {
    let idx = 0;
    while (idx < parent.keys.length && this.compareKeys(parent.keys[idx], key) < 0) {
      idx++;
    }

    parent.keys.splice(idx, 0, key);
    parent.children.splice(idx + 1, 0, rightChild);
    rightChild.parent = parent;

    if (parent.keys.length >= this.order) {
      this.splitInternalNode(parent);
    }
  }

  /**
   * Split an internal node.
   */
  private splitInternalNode(internal: BPlusInternalNode<K, V>): void {
    const mid = Math.floor(internal.keys.length / 2);
    const promotedKey = internal.keys[mid];

    const rightInternal = new BPlusInternalNode<K, V>();
    rightInternal.keys = internal.keys.splice(mid + 1);
    rightInternal.children = internal.children.splice(mid + 1);

    // Remove the promoted key from left node
    internal.keys.splice(mid, 1);

    for (const child of rightInternal.children) {
      child.parent = rightInternal;
    }

    if (internal.parent === null) {
      // Root internal node split
      const newRoot = new BPlusInternalNode<K, V>();
      newRoot.keys = [promotedKey];
      newRoot.children = [internal, rightInternal];
      internal.parent = newRoot;
      rightInternal.parent = newRoot;
      this.root = newRoot;
    } else {
      rightInternal.parent = internal.parent;
      this.insertIntoParent(internal.parent, promotedKey, rightInternal);
    }
  }

  /**
   * Handle underflow after deletion.
   */
  private handleUnderflow(node: BPlusNode<K, V>): void {
    if (node.parent === null) {
      // Root node
      if (!node.isLeaf) {
        const internal = node as BPlusInternalNode<K, V>;
        if (internal.keys.length === 0) {
          // New root is the single child
          this.root = internal.children[0];
          this.root.parent = null;
        }
      }
      return;
    }

    const minKeys = node.isLeaf
      ? Math.ceil((this.order - 1) / 2)
      : Math.ceil(this.order / 2) - 1;

    if (node.keys.length >= minKeys) {
      return; // No underflow
    }

    const parent = node.parent;
    const childIdx = parent.children.indexOf(node);

    const leftSibling =
      childIdx > 0 ? (parent.children[childIdx - 1] as BPlusNode<K, V>) : null;
    const rightSibling =
      childIdx < parent.children.length - 1
        ? (parent.children[childIdx + 1] as BPlusNode<K, V>)
        : null;

    // 1. Try borrowing from left sibling
    if (leftSibling && leftSibling.keys.length > minKeys) {
      this.borrowFromLeft(node, leftSibling, parent, childIdx);
      return;
    }

    // 2. Try borrowing from right sibling
    if (rightSibling && rightSibling.keys.length > minKeys) {
      this.borrowFromRight(node, rightSibling, parent, childIdx);
      return;
    }

    // 3. Merge with sibling
    if (leftSibling) {
      this.mergeNodes(leftSibling, node, parent, childIdx - 1);
    } else if (rightSibling) {
      this.mergeNodes(node, rightSibling, parent, childIdx);
    }
  }

  private borrowFromLeft(
    node: BPlusNode<K, V>,
    leftSibling: BPlusNode<K, V>,
    parent: BPlusInternalNode<K, V>,
    childIdx: number
  ): void {
    if (node.isLeaf) {
      const leaf = node as BPlusLeafNode<K, V>;
      const leftLeaf = leftSibling as BPlusLeafNode<K, V>;

      const borrowedKey = leftLeaf.keys.pop()!;
      const borrowedVal = leftLeaf.values.pop()!;

      leaf.keys.unshift(borrowedKey);
      leaf.values.unshift(borrowedVal);

      // Update separator key in parent
      parent.keys[childIdx - 1] = leaf.keys[0];
    } else {
      const internal = node as BPlusInternalNode<K, V>;
      const leftInternal = leftSibling as BPlusInternalNode<K, V>;

      const borrowedKey = leftInternal.keys.pop()!;
      const borrowedChild = leftInternal.children.pop()!;

      const parentKey = parent.keys[childIdx - 1];
      parent.keys[childIdx - 1] = borrowedKey;

      internal.keys.unshift(parentKey);
      internal.children.unshift(borrowedChild);
      borrowedChild.parent = internal;
    }
  }

  private borrowFromRight(
    node: BPlusNode<K, V>,
    rightSibling: BPlusNode<K, V>,
    parent: BPlusInternalNode<K, V>,
    childIdx: number
  ): void {
    if (node.isLeaf) {
      const leaf = node as BPlusLeafNode<K, V>;
      const rightLeaf = rightSibling as BPlusLeafNode<K, V>;

      const borrowedKey = rightLeaf.keys.shift()!;
      const borrowedVal = rightLeaf.values.shift()!;

      leaf.keys.push(borrowedKey);
      leaf.values.push(borrowedVal);

      // Update separator key in parent
      parent.keys[childIdx] = rightLeaf.keys[0];
    } else {
      const internal = node as BPlusInternalNode<K, V>;
      const rightInternal = rightSibling as BPlusInternalNode<K, V>;

      const borrowedKey = rightInternal.keys.shift()!;
      const borrowedChild = rightInternal.children.shift()!;

      const parentKey = parent.keys[childIdx];
      parent.keys[childIdx] = borrowedKey;

      internal.keys.push(parentKey);
      internal.children.push(borrowedChild);
      borrowedChild.parent = internal;
    }
  }

  private mergeNodes(
    left: BPlusNode<K, V>,
    right: BPlusNode<K, V>,
    parent: BPlusInternalNode<K, V>,
    parentKeyIdx: number
  ): void {
    if (left.isLeaf) {
      const leftLeaf = left as BPlusLeafNode<K, V>;
      const rightLeaf = right as BPlusLeafNode<K, V>;

      leftLeaf.keys.push(...rightLeaf.keys);
      leftLeaf.values.push(...rightLeaf.values);

      leftLeaf.next = rightLeaf.next;
      if (rightLeaf.next) {
        rightLeaf.next.prev = leftLeaf;
      }
    } else {
      const leftInternal = left as BPlusInternalNode<K, V>;
      const rightInternal = right as BPlusInternalNode<K, V>;

      const separatorKey = parent.keys[parentKeyIdx];
      leftInternal.keys.push(separatorKey, ...rightInternal.keys);
      leftInternal.children.push(...rightInternal.children);

      for (const child of rightInternal.children) {
        child.parent = leftInternal;
      }
    }

    // Remove separator key and right child from parent
    parent.keys.splice(parentKeyIdx, 1);
    parent.children.splice(parentKeyIdx + 1, 1);

    // Recursively check parent for underflow
    this.handleUnderflow(parent);
  }

  /**
   * Generic key comparison (numbers, strings, ISO dates).
   */
  private compareKeys(a: K, b: K): number {
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    const sa = String(a);
    const sb = String(b);
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  }
}
