export class WaitForGraph {
  private edges: Map<string, Set<string>> = new Map();

  public addEdge(waiter: string, holder: string): boolean {
    if (!this.edges.has(waiter)) {
      this.edges.set(waiter, new Set());
    }
    this.edges.get(waiter)!.add(holder);

    return this.detectCycle();
  }

  public removeEdge(waiter: string, holder: string): void {
    const holders = this.edges.get(waiter);
    if (holders) {
      holders.delete(holder);
      if (holders.size === 0) {
        this.edges.delete(waiter);
      }
    }
  }

  public removeNode(node: string): void {
    this.edges.delete(node);
    for (const [waiter, holders] of this.edges.entries()) {
      holders.delete(node);
      if (holders.size === 0) {
        this.edges.delete(waiter);
      }
    }
  }

  private detectCycle(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    for (const node of this.edges.keys()) {
      if (this.isCyclic(node, visited, recStack)) {
        return true;
      }
    }
    return false;
  }

  private isCyclic(node: string, visited: Set<string>, recStack: Set<string>): boolean {
    if (!visited.has(node)) {
      visited.add(node);
      recStack.add(node);

      const neighbors = this.edges.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && this.isCyclic(neighbor, visited, recStack)) {
            return true;
          } else if (recStack.has(neighbor)) {
            return true;
          }
        }
      }
    }
    recStack.delete(node);
    return false;
  }
}
