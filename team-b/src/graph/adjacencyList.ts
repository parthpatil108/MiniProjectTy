import type { GraphNode, GraphObject } from '../types';

export class AdjacencyMatrix {
  private readonly positions = new Map<GraphNode, number>();
  private readonly matrix: boolean[][];

  constructor(nodes: Iterable<GraphNode>, edges: Iterable<readonly [GraphNode, GraphNode]>) {
    const orderedNodes = [...new Set(nodes)].sort();
    for (const [left, right] of edges) {
      if (!orderedNodes.includes(left)) orderedNodes.push(left);
      if (!orderedNodes.includes(right)) orderedNodes.push(right);
    }
    orderedNodes.forEach((node, index) => this.positions.set(node, index));
    this.matrix = Array.from({ length: orderedNodes.length }, () => Array<boolean>(orderedNodes.length).fill(false));
    for (const [left, right] of edges) {
      const i = this.positions.get(left)!; const j = this.positions.get(right)!;
      this.matrix[i][j] = true; this.matrix[j][i] = true;
    }
  }

  hasEdge(left: GraphNode, right: GraphNode): boolean {
    const i = this.positions.get(left); const j = this.positions.get(right);
    return i !== undefined && j !== undefined && this.matrix[i][j];
  }
}

export interface GraphRepresentationComparison {
  node_count: number;
  edge_count: number;
  lookup_checks: number;
  adjacency_list: { representation_type: 'ADJACENCY_LIST'; successful_lookups: number; stored_neighbor_references: number };
  adjacency_matrix: { representation_type: 'ADJACENCY_MATRIX'; successful_lookups: number; allocated_boolean_cells: number };
}

export function compareGraphRepresentations(nodes: Iterable<GraphNode>, edges: Iterable<readonly [GraphNode, GraphNode]>, lookups: Iterable<readonly [GraphNode, GraphNode]>): GraphRepresentationComparison {
  const edgeList = [...edges]; const nodeSet = new Set(nodes);
  for (const [left, right] of edgeList) { nodeSet.add(left); nodeSet.add(right); }
  const nodeList = [...nodeSet].sort(); const lookupList = [...lookups];
  const adjacencyList = new AdjacencyList();
  nodeList.forEach((node) => adjacencyList.addNode(node));
  edgeList.forEach(([left, right]) => adjacencyList.addUndirectedEdge(left, right));
  const adjacencyMatrix = new AdjacencyMatrix(nodeList, edgeList);
  const listHits = lookupList.filter(([left, right]) => adjacencyList.getNeighbors(left).includes(right)).length;
  const matrixHits = lookupList.filter(([left, right]) => adjacencyMatrix.hasEdge(left, right)).length;
  const storedNeighborReferences = Object.values(adjacencyList.toObject()).reduce((sum, neighbors) => sum + neighbors.length, 0);
  return { node_count: nodeList.length, edge_count: storedNeighborReferences / 2, lookup_checks: lookupList.length, adjacency_list: { representation_type: 'ADJACENCY_LIST', successful_lookups: listHits, stored_neighbor_references: storedNeighborReferences }, adjacency_matrix: { representation_type: 'ADJACENCY_MATRIX', successful_lookups: matrixHits, allocated_boolean_cells: nodeList.length ** 2 } };
}

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
