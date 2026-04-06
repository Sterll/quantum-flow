import { describe, it, expect, vi } from 'vitest'
import { autoLayout, applyAutoLayout } from '../src/layout/autoLayout'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowNode, FlowConnection, FlowGraph } from '../src/types'
import { NODE_W } from '../src/constants'

const makeNode = (id: string, x = 0, y = 0): FlowNode => ({
  id, type: 'test/node', label: id,
  position: { x, y },
  inputs: [{ id: 'in', type: 'exec', label: '' }],
  outputs: [{ id: 'out', type: 'exec', label: '' }],
  data: {},
})

const makeConn = (id: string, from: string, to: string): FlowConnection => ({
  id, fromNodeId: from, fromPinId: 'out', toNodeId: to, toPinId: 'in',
})

describe('autoLayout', () => {
  it('returns empty map for empty graph', () => {
    const positions = autoLayout({ nodes: [], connections: [] })
    expect(positions.size).toBe(0)
  })

  it('positions a single node at padding offset', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('n1')],
      connections: [],
    }
    const positions = autoLayout(graph)
    const pos = positions.get('n1')!
    expect(pos.x).toBe(60) // default padding
    expect(pos.y).toBe(60)
  })

  it('assigns connected nodes to different layers (LR)', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
      connections: [makeConn('c1', 'a', 'b'), makeConn('c2', 'b', 'c')],
    }
    const positions = autoLayout(graph, { direction: 'LR' })
    // a in layer 0, b in layer 1, c in layer 2
    expect(positions.get('a')!.x).toBeLessThan(positions.get('b')!.x)
    expect(positions.get('b')!.x).toBeLessThan(positions.get('c')!.x)
    // All same Y (single chain)
    expect(positions.get('a')!.y).toBe(positions.get('b')!.y)
    expect(positions.get('b')!.y).toBe(positions.get('c')!.y)
  })

  it('assigns connected nodes to different layers (TB)', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('a'), makeNode('b')],
      connections: [makeConn('c1', 'a', 'b')],
    }
    const positions = autoLayout(graph, { direction: 'TB' })
    // TB: layers go vertically
    expect(positions.get('a')!.y).toBeLessThan(positions.get('b')!.y)
    // Same X (single chain)
    expect(positions.get('a')!.x).toBe(positions.get('b')!.x)
  })

  it('places parallel nodes in same layer', () => {
    // a -> b, a -> c (b and c are parallel in layer 1)
    const graph: FlowGraph = {
      nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
      connections: [makeConn('c1', 'a', 'b'), makeConn('c2', 'a', 'c')],
    }
    const positions = autoLayout(graph, { direction: 'LR' })
    expect(positions.get('b')!.x).toBe(positions.get('c')!.x) // same layer
    expect(positions.get('b')!.y).not.toBe(positions.get('c')!.y) // different order
  })

  it('handles disconnected components', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('a'), makeNode('b')],
      connections: [], // no connections
    }
    const positions = autoLayout(graph)
    expect(positions.size).toBe(2)
    expect(positions.has('a')).toBe(true)
    expect(positions.has('b')).toBe(true)
  })

  it('respects custom spacing options', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('a'), makeNode('b')],
      connections: [makeConn('c1', 'a', 'b')],
    }
    const positions = autoLayout(graph, {
      direction: 'LR',
      nodeSpacingX: 200,
      padding: 10,
    })
    const ax = positions.get('a')!.x
    const bx = positions.get('b')!.x
    // b.x = padding + 1 * (NODE_W + spacingX)
    expect(bx - ax).toBe(NODE_W + 200)
  })

  it('handles cycles without crashing', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('a'), makeNode('b')],
      connections: [makeConn('c1', 'a', 'b'), makeConn('c2', 'b', 'a')],
    }
    const positions = autoLayout(graph)
    expect(positions.size).toBe(2)
  })
})

describe('applyAutoLayout', () => {
  it('applies layout positions to a store', () => {
    const store = new GraphStore()
    store.addNode(makeNode('a', 0, 0))
    store.addNode(makeNode('b', 0, 0))
    store.addConnection(makeConn('c1', 'a', 'b'))

    applyAutoLayout(store)

    const a = store.getNode('a')!
    const b = store.getNode('b')!
    expect(a.position.x).not.toBe(0)
    expect(b.position.x).toBeGreaterThan(a.position.x)
  })

  it('wraps moves in a batch', () => {
    const store = new GraphStore()
    store.addNode(makeNode('a'))
    const batchSpy = vi.spyOn(store, 'batch')

    applyAutoLayout(store)

    expect(batchSpy).toHaveBeenCalledOnce()
  })
})
