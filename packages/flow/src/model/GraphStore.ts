import type { FlowNode, FlowConnection, FlowGraph, FlowNodePosition, FlowWaypoint } from '../types'
import { EventBus } from './EventBus'
import type { Validator } from './Validator'

export interface GraphEvents {
  'node:added': { node: FlowNode }
  'node:removed': { nodeId: string; removedConnections: string[] }
  'node:moved': { nodeId: string; position: FlowNodePosition }
  'node:dataChanged': { nodeId: string; data: Record<string, unknown> }
  'connection:added': { connection: FlowConnection }
  'connection:removed': { connectionId: string }
  'connection:updated': { connection: FlowConnection }
  'graph:cleared': {}
  'graph:imported': { graph: FlowGraph }
  'batch:start': {}
  'batch:end': { events: Array<{ type: string; payload: unknown }> }
}

export interface GraphStoreOptions {
  validator?: Validator
  eventBus?: EventBus<GraphEvents>
}

export class GraphStore {
  private nodes = new Map<string, FlowNode>()
  private connections = new Map<string, FlowConnection>()
  private validator?: Validator
  private _events: EventBus<GraphEvents>
  private batching = false
  private batchedEvents: Array<{ type: string; payload: unknown }> = []

  constructor(options?: GraphStoreOptions) {
    this.validator = options?.validator
    this._events = options?.eventBus ?? new EventBus<GraphEvents>()
  }

  get events(): EventBus<GraphEvents> {
    return this._events
  }

  getState(): FlowGraph {
    return {
      nodes: this.getNodes(),
      connections: this.getConnections(),
    }
  }

  getNode(id: string): FlowNode | undefined {
    const node = this.nodes.get(id)
    return node ? this.cloneNode(node) : undefined
  }

  getNodes(): FlowNode[] {
    return Array.from(this.nodes.values()).map(n => this.cloneNode(n))
  }

  getConnections(): FlowConnection[] {
    return Array.from(this.connections.values()).map(c => ({ ...c }))
  }

  getConnectionsForNode(nodeId: string): FlowConnection[] {
    return this.getConnections().filter(
      c => c.fromNodeId === nodeId || c.toNodeId === nodeId,
    )
  }

  getConnectionsForPin(nodeId: string, pinId: string): FlowConnection[] {
    return this.getConnections().filter(
      c => (c.fromNodeId === nodeId && c.fromPinId === pinId)
        || (c.toNodeId === nodeId && c.toPinId === pinId),
    )
  }

  hasConnection(fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string): boolean {
    for (const c of this.connections.values()) {
      if (c.fromNodeId === fromNodeId && c.fromPinId === fromPinId
        && c.toNodeId === toNodeId && c.toPinId === toPinId) {
        return true
      }
    }
    return false
  }

  addNode(node: FlowNode): void {
    this.runValidation('addNode', node)
    this.nodes.set(node.id, { ...node })
    this.emitEvent('node:added', { node: { ...node } })
  }

  removeNode(nodeId: string): void {
    this.runValidation('removeNode', { nodeId })
    this.nodes.delete(nodeId)
    const removedConnections: string[] = []
    for (const [id, conn] of this.connections) {
      if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
        this.connections.delete(id)
        removedConnections.push(id)
      }
    }
    this.emitEvent('node:removed', { nodeId, removedConnections })
  }

  moveNode(nodeId: string, position: FlowNodePosition): void {
    const node = this.nodes.get(nodeId)
    if (!node) return
    this.nodes.set(nodeId, { ...node, position })
    this.emitEvent('node:moved', { nodeId, position })
  }

  updateNodeData(nodeId: string, data: Record<string, unknown>): void {
    const node = this.nodes.get(nodeId)
    if (!node) return
    const merged = { ...node.data, ...data }
    this.nodes.set(nodeId, { ...node, data: merged })
    this.emitEvent('node:dataChanged', { nodeId, data: merged })
  }

  addConnection(connection: FlowConnection): void {
    this.runValidation('addConnection', connection)
    this.connections.set(connection.id, { ...connection })
    this.emitEvent('connection:added', { connection: { ...connection } })
  }

  removeConnection(connectionId: string): void {
    this.runValidation('removeConnection', { connectionId })
    this.connections.delete(connectionId)
    this.emitEvent('connection:removed', { connectionId })
  }

  getConnection(connectionId: string): FlowConnection | undefined {
    const conn = this.connections.get(connectionId)
    return conn ? { ...conn } : undefined
  }

  updateConnectionWaypoints(connectionId: string, waypoints: FlowWaypoint[]): void {
    const conn = this.connections.get(connectionId)
    if (!conn) return
    const updated = { ...conn, waypoints: [...waypoints] }
    this.connections.set(connectionId, updated)
    this.emitEvent('connection:updated', { connection: { ...updated } })
  }

  batch(fn: () => void): void {
    this.batching = true
    this.batchedEvents = []
    this._events.emit('batch:start', {})
    try {
      fn()
    } finally {
      this.batching = false
      this._events.emit('batch:end', { events: this.batchedEvents })
      this.batchedEvents = []
    }
  }

  clear(): void {
    this.nodes.clear()
    this.connections.clear()
    this.emitEvent('graph:cleared', {})
  }

  importGraph(graph: FlowGraph): void {
    this.nodes.clear()
    this.connections.clear()
    for (const node of graph.nodes) {
      this.nodes.set(node.id, { ...node })
    }
    for (const conn of graph.connections) {
      this.connections.set(conn.id, { ...conn })
    }
    this.emitEvent('graph:imported', { graph: this.getState() })
  }

  clone(): GraphStore {
    const cloned = new GraphStore({ validator: this.validator })
    cloned.importGraph(this.getState())
    return cloned
  }

  private runValidation(action: string, payload: unknown): void {
    if (!this.validator) return
    const result = this.validator.validate({
      graph: this.getState(),
      action: action as any,
      payload: payload as any,
    })
    if (!result.valid) {
      throw new Error(result.reason)
    }
  }

  private cloneNode(node: FlowNode): FlowNode {
    return {
      ...node,
      position: { ...node.position },
      inputs: node.inputs.map(p => ({ ...p })),
      outputs: node.outputs.map(p => ({ ...p })),
      data: node.data ? JSON.parse(JSON.stringify(node.data)) : undefined,
    }
  }

  private emitEvent<K extends keyof GraphEvents>(event: K, payload: GraphEvents[K]): void {
    if (this.batching) {
      this.batchedEvents.push({ type: event as string, payload })
    }
    this._events.emit(event, payload)
  }
}
