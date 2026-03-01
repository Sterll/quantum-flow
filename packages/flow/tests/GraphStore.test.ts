import { describe, it, expect, vi } from 'vitest'
import { GraphStore } from '../src/model/GraphStore'
import { Validator } from '../src/model/Validator'
import type { FlowNode, FlowConnection } from '../src/types'

const makeNode = (id: string, inputs: Array<{ id: string; type: string }> = [], outputs: Array<{ id: string; type: string }> = []): FlowNode => ({
  id,
  type: 'test/node',
  label: id,
  position: { x: 0, y: 0 },
  inputs: inputs.map(p => ({ ...p, label: p.id })),
  outputs: outputs.map(p => ({ ...p, label: p.id })),
  data: {},
})

const makeConn = (id: string, from: string, fromPin: string, to: string, toPin: string): FlowConnection => ({
  id, fromNodeId: from, fromPinId: fromPin, toNodeId: to, toPinId: toPin,
})

describe('GraphStore', () => {
  it('addNode stores node and emits event', () => {
    const store = new GraphStore()
    const handler = vi.fn()
    store.events.on('node:added', handler)
    store.addNode(makeNode('n1'))
    expect(store.getNodes()).toHaveLength(1)
    expect(handler).toHaveBeenCalledWith({ node: expect.objectContaining({ id: 'n1' }) })
  })

  it('removeNode cascades connections and emits event', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', [{ id: 'in', type: 'exec' }], []))
    store.addConnection(makeConn('c1', 'n1', 'out', 'n2', 'in'))
    const handler = vi.fn()
    store.events.on('node:removed', handler)
    store.removeNode('n1')
    expect(store.getNodes()).toHaveLength(1)
    expect(store.getConnections()).toHaveLength(0)
    expect(handler).toHaveBeenCalledWith({ nodeId: 'n1', removedConnections: ['c1'] })
  })

  it('addConnection stores connection and emits event', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', [{ id: 'in', type: 'exec' }], []))
    const handler = vi.fn()
    store.events.on('connection:added', handler)
    store.addConnection(makeConn('c1', 'n1', 'out', 'n2', 'in'))
    expect(store.getConnections()).toHaveLength(1)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('moveNode updates position and emits event', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const handler = vi.fn()
    store.events.on('node:moved', handler)
    store.moveNode('n1', { x: 100, y: 200 })
    expect(store.getNode('n1')!.position).toEqual({ x: 100, y: 200 })
    expect(handler).toHaveBeenCalledWith({ nodeId: 'n1', position: { x: 100, y: 200 } })
  })

  it('updateNodeData merges data and emits event', () => {
    const store = new GraphStore()
    store.addNode({ ...makeNode('n1'), data: { a: 1 } })
    store.updateNodeData('n1', { b: 2 })
    expect(store.getNode('n1')!.data).toEqual({ a: 1, b: 2 })
  })

  it('getState returns a FlowGraph snapshot', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const state = store.getState()
    expect(state.nodes).toHaveLength(1)
    expect(state.connections).toHaveLength(0)
  })

  it('getConnectionsForNode returns all connections touching a node', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', [{ id: 'in', type: 'exec' }], [{ id: 'out2', type: 'exec' }]))
    store.addNode(makeNode('n3', [{ id: 'in', type: 'exec' }], []))
    store.addConnection(makeConn('c1', 'n1', 'out', 'n2', 'in'))
    store.addConnection(makeConn('c2', 'n2', 'out2', 'n3', 'in'))
    expect(store.getConnectionsForNode('n2')).toHaveLength(2)
    expect(store.getConnectionsForNode('n1')).toHaveLength(1)
  })

  it('getConnectionsForPin returns connections for a specific pin', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', [], [{ id: 'out', type: 'exec' }, { id: 'out2', type: 'string' }]))
    store.addNode(makeNode('n2', [{ id: 'in', type: 'exec' }], []))
    store.addNode(makeNode('n3', [{ id: 'in', type: 'string' }], []))
    store.addConnection(makeConn('c1', 'n1', 'out', 'n2', 'in'))
    store.addConnection(makeConn('c2', 'n1', 'out2', 'n3', 'in'))
    expect(store.getConnectionsForPin('n1', 'out')).toHaveLength(1)
    expect(store.getConnectionsForPin('n1', 'out2')).toHaveLength(1)
  })

  it('hasConnection checks if a specific connection exists', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', [{ id: 'in', type: 'exec' }], []))
    store.addConnection(makeConn('c1', 'n1', 'out', 'n2', 'in'))
    expect(store.hasConnection('n1', 'out', 'n2', 'in')).toBe(true)
    expect(store.hasConnection('n2', 'in', 'n1', 'out')).toBe(false)
  })

  it('clear removes everything and emits event', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    const handler = vi.fn()
    store.events.on('graph:cleared', handler)
    store.clear()
    expect(store.getNodes()).toHaveLength(0)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('batch groups events and emits batch:start/end', () => {
    const store = new GraphStore()
    const batchStart = vi.fn()
    const batchEnd = vi.fn()
    store.events.on('batch:start', batchStart)
    store.events.on('batch:end', batchEnd)
    store.batch(() => {
      store.addNode(makeNode('n1'))
      store.addNode(makeNode('n2'))
    })
    expect(batchStart).toHaveBeenCalledOnce()
    expect(batchEnd).toHaveBeenCalledOnce()
    expect(store.getNodes()).toHaveLength(2)
  })

  it('throws on validation failure (with validator)', () => {
    const validator = new Validator([Validator.noDuplicateNodeId()])
    const store = new GraphStore({ validator })
    store.addNode(makeNode('n1'))
    expect(() => store.addNode(makeNode('n1'))).toThrow('Duplicate node ID')
  })
})
