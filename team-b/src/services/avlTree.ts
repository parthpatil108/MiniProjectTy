export interface AvlNode<T> {
  key: string;
  value: T;
  height: number;
  left: AvlNode<T> | null;
  right: AvlNode<T> | null;
}

const height = <T>(node: AvlNode<T> | null): number => node?.height ?? 0;
const refresh = <T>(node: AvlNode<T>): AvlNode<T> => {
  node.height = 1 + Math.max(height(node.left), height(node.right));
  return node;
};
const balance = <T>(node: AvlNode<T>): number => height(node.left) - height(node.right);

export class AvlTree<T> {
  private root: AvlNode<T> | null = null;
  private count = 0;
  get size(): number { return this.count; }

  get(key: string): T | undefined {
    let node = this.root;
    while (node) {
      if (key === node.key) return node.value;
      node = key < node.key ? node.left : node.right;
    }
    return undefined;
  }
  set(key: string, value: T): void {
    if (this.get(key) === undefined) this.count += 1;
    this.root = this.insert(this.root, key, value);
  }
  delete(key: string): boolean {
    if (this.get(key) === undefined) return false;
    this.root = this.remove(this.root, key);
    this.count -= 1;
    return true;
  }
  validateBalance(): boolean {
    const visit = (node: AvlNode<T> | null): number => {
      if (!node) return 0;
      const left = visit(node.left); const right = visit(node.right);
      if (Math.abs(left - right) > 1 || node.height !== 1 + Math.max(left, right)) throw new Error(`AVL invariant violated at ${node.key}`);
      return node.height;
    };
    visit(this.root); return true;
  }
  private rotateRight(y: AvlNode<T>): AvlNode<T> {
    const x = y.left!; const transfer = x.right; x.right = y; y.left = transfer; refresh(y); return refresh(x);
  }
  private rotateLeft(x: AvlNode<T>): AvlNode<T> {
    const y = x.right!; const transfer = y.left; y.left = x; x.right = transfer; refresh(x); return refresh(y);
  }
  private rebalance(node: AvlNode<T>): AvlNode<T> {
    refresh(node); const factor = balance(node);
    if (factor > 1) {
      if (balance(node.left!) < 0) node.left = this.rotateLeft(node.left!);
      return this.rotateRight(node);
    }
    if (factor < -1) {
      if (balance(node.right!) > 0) node.right = this.rotateRight(node.right!);
      return this.rotateLeft(node);
    }
    return node;
  }
  private insert(node: AvlNode<T> | null, key: string, value: T): AvlNode<T> {
    if (!node) return { key, value, height: 1, left: null, right: null };
    if (key === node.key) { node.value = value; return node; }
    if (key < node.key) node.left = this.insert(node.left, key, value);
    else node.right = this.insert(node.right, key, value);
    return this.rebalance(node);
  }
  private remove(node: AvlNode<T> | null, key: string): AvlNode<T> | null {
    if (!node) return null;
    if (key < node.key) node.left = this.remove(node.left, key);
    else if (key > node.key) node.right = this.remove(node.right, key);
    else {
      if (!node.left) return node.right;
      if (!node.right) return node.left;
      let successor = node.right;
      while (successor.left) successor = successor.left;
      node.key = successor.key; node.value = successor.value;
      node.right = this.remove(node.right, successor.key);
    }
    return this.rebalance(node);
  }
}
