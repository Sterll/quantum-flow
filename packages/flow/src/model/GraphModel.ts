import type { FlowNode, FlowConnection, FlowGraph, FlowNodePosition } from '../types'

export class GraphModel {
  private nodes: Map<string, FlowNode> = new Map()
  private connections: Map<string, FlowConnection> = new Map()

  addNode(node: FlowNode): void {
    this.nodes.set(node.id, { ...node })
  }

  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId)
    for (const [id, conn] of this.connections) {
      if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
        this.connections.delete(id)
      }
    }
  }

  moveNode(nodeId: string, position: FlowNodePosition): void {
    const node = this.nodes.get(nodeId)
    if (node) {
      this.nodes.set(nodeId, { ...node, position })
    }
  }

  updateNodeData(nodeId: string, data: Record<string, unknown>): void {
    const node = this.nodes.get(nodeId)
    if (node) {
      this.nodes.set(nodeId, { ...node, data: { ...node.data, ...data } })
    }
  }

  addConnection(connection: FlowConnection): void {
    this.connections.set(connection.id, { ...connection })
  }

  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId)
  }

  getNodes(): FlowNode[] {
    return Array.from(this.nodes.values())
  }

  getConnections(): FlowConnection[] {
    return Array.from(this.connections.values())
  }

  getNode(id: string): FlowNode | undefined {
    return this.nodes.get(id)
  }

  serialize(): FlowGraph {
    return {
      nodes: this.getNodes(),
      connections: this.getConnections(),
    }
  }

  static fromJSON(graph: FlowGraph): GraphModel {
    const model = new GraphModel()
    for (const node of graph.nodes) model.addNode(node)
    for (const conn of graph.connections) model.addConnection(conn)
    return model
  }
}
