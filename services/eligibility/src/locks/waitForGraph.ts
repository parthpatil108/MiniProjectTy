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

  public findCycle(): string[] | null {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const parentMap = new Map<string, string>();

    for (const startNode of this.edges.keys()) {
      if (!visited.has(startNode)) {
        const cycle = this.dfsCycle(startNode, visited, recStack, parentMap);
        if (cycle) return cycle;
      }
    }
    return null;
  }

  private dfsCycle(
    node: string,
    visited: Set<string>,
    recStack: Set<string>,
    parentMap: Map<string, string>
  ): string[] | null {
    visited.add(node);
    recStack.add(node);

    const neighbors = this.edges.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          parentMap.set(neighbor, node);
          const cycle = this.dfsCycle(neighbor, visited, recStack, parentMap);
          if (cycle) return cycle;
        } else if (recStack.has(neighbor)) {
          const cyclePath: string[] = [neighbor, node];
          let curr = node;
          while (parentMap.has(curr) && parentMap.get(curr) !== neighbor) {
            curr = parentMap.get(curr)!;
            cyclePath.push(curr);
          }
          cyclePath.reverse();
          return cyclePath;
        }
      }
    }

    recStack.delete(node);
    return null;
  }

  private detectCycle(): boolean {
    return this.findCycle() !== null;
  }
}

