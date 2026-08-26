class AdjacencyList {
  constructor() {
    this.neighbors = new Map();
  }

  addNode(node) {
    if (!this.neighbors.has(node)) {
      this.neighbors.set(node, new Set());
    }
  }

  addUndirectedEdge(leftNode, rightNode) {
    this.addNode(leftNode);
    this.addNode(rightNode);
    this.neighbors.get(leftNode).add(rightNode);
    this.neighbors.get(rightNode).add(leftNode);
  }

  removeNode(node) {
    const connectedNodes = this.neighbors.get(node);
    if (!connectedNodes) {
      return;
    }

    for (const connectedNode of connectedNodes) {
      this.neighbors.get(connectedNode)?.delete(node);
    }
    this.neighbors.delete(node);
  }

  getNeighbors(node) {
    return [...(this.neighbors.get(node) ?? [])].sort();
  }

  toObject() {
    return Object.fromEntries(
      [...this.neighbors.keys()]
        .sort()
        .map((node) => [node, this.getNeighbors(node)])
    );
  }
}

module.exports = { AdjacencyList };
