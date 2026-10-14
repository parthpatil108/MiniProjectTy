import type { GraphNode, GraphObject } from '../types';

export class AdjacencyList {
  private readonly neighbors = new Map<GraphNode, Set<GraphNode>>();

  addNode(node: GraphNode): void {
    if (!this.neighbors.has(node)) this.neighbors.set(node, new Set());
  }

  addUndirectedEdge(leftNode: GraphNode, rightNode: GraphNode): void {
    this.addNode(leftNode);
    this.addNode(rightNode);
    this.neighbors.get(leftNode)!.add(rightNode);
    this.neighbors.get(rightNode)!.add(leftNode);
  }

  removeNode(node: GraphNode): void {
    const connectedNodes = this.neighbors.get(node);
    if (!connectedNodes) return;
    for (const connectedNode of connectedNodes) this.neighbors.get(connectedNode)?.delete(node);
    this.neighbors.delete(node);
  }

  getNeighbors(node: GraphNode): GraphNode[] {
    return [...(this.neighbors.get(node) ?? [])].sort();
  }

  toObject(): GraphObject {
    return Object.fromEntries([...this.neighbors.keys()].sort().map((node) => [node, this.getNeighbors(node)]));
  }
}
