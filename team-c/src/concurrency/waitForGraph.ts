export class WaitForGraph {
  private adjacencyList: Map<string, Set<string>> = new Map();

  public addEdge(fromTxnId: string, toTxnId: string): boolean {
    if (fromTxnId === toTxnId) return false;

    if (!this.adjacencyList.has(fromTxnId)) {
      this.adjacencyList.set(fromTxnId, new Set());
    }
    this.adjacencyList.get(fromTxnId)!.add(toTxnId);

    // Check if cycle exists starting from fromTxnId
    if (this.hasCycle(fromTxnId)) {
      // Cycle created! Remove edge and return true (cycle detected)
      this.removeEdge(fromTxnId, toTxnId);
      return true;
    }

    return false;
  }

  public removeEdge(fromTxnId: string, toTxnId: string): void {
    const neighbors = this.adjacencyList.get(fromTxnId);
    if (neighbors) {
      neighbors.delete(toTxnId);
      if (neighbors.size === 0) {
        this.adjacencyList.delete(fromTxnId);
      }
    }
  }

  public removeTxn(txnId: string): void {
    this.adjacencyList.delete(txnId);
    for (const neighbors of this.adjacencyList.values()) {
      neighbors.delete(txnId);
    }
  }

  public hasCycle(startTxnId: string): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (curr: string): boolean => {
      visited.add(curr);
      recStack.add(curr);

      const neighbors = this.adjacencyList.get(curr);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) return true;
          } else if (recStack.has(neighbor)) {
            return true; // Cycle detected!
          }
        }
      }

      recStack.delete(curr);
      return false;
    };

    return dfs(startTxnId);
  }

  public clear(): void {
    this.adjacencyList.clear();
  }

  public getGraph(): Map<string, Set<string>> {
    return this.adjacencyList;
  }
}
