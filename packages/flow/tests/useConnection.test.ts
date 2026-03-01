import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConnection } from '../src/hooks/useConnection'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowNode } from '../src/types'

const makeNode = (id: string, x: number, y: number, inputs: Array<{ id: string; type: string }> = [], outputs: Array<{ id: string; type: string }> = []): FlowNode => ({
  id, type: 'test/node', label: id, position: { x, y },
  inputs: inputs.map(p => ({ ...p, label: p.id })),
  outputs: outputs.map(p => ({ ...p, label: p.id })),
  data: {},
})

describe('useConnection', () => {
  it('starts with no draft', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useConnection(store))
    expect(result.current.draft).toBeNull()
  })

  it('startConnection sets the draft', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useConnection(store))
    act(() => {
      result.current.startConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    expect(result.current.draft).not.toBeNull()
    expect(result.current.draft!.fromNodeId).toBe('n1')
    expect(result.current.draft!.fromPinId).toBe('out')
  })

  it('updateDraft updates the cursor position', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useConnection(store))
    act(() => {
      result.current.startConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    act(() => { result.current.updateDraft({ x: 200, y: 300 }) })
    expect(result.current.draft!.toPos).toEqual({ x: 200, y: 300 })
  })

  it('cancelConnection clears the draft', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useConnection(store))
    act(() => {
      result.current.startConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    act(() => { result.current.cancelConnection() })
    expect(result.current.draft).toBeNull()
  })

  it('finishConnection adds connection to store (output to input)', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 0, 0, [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', 200, 0, [{ id: 'in', type: 'exec' }], []))
    const { result } = renderHook(() => useConnection(store))
    act(() => {
      result.current.startConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    act(() => {
      result.current.finishConnection({
        nodeId: 'n2', pinId: 'in', isOutput: false, pos: { x: 200, y: 100 },
      })
    })
    expect(store.getConnections()).toHaveLength(1)
    expect(result.current.draft).toBeNull()
  })

  it('finishConnection adds connection (input to output, reversed)', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 0, 0, [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', 200, 0, [{ id: 'in', type: 'exec' }], []))
    const { result } = renderHook(() => useConnection(store))
    act(() => {
      result.current.startConnection({
        nodeId: 'n2', pinId: 'in', isOutput: false, pos: { x: 200, y: 100 },
      })
    })
    act(() => {
      result.current.finishConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    const conns = store.getConnections()
    expect(conns).toHaveLength(1)
    expect(conns[0].fromNodeId).toBe('n1')
    expect(conns[0].toNodeId).toBe('n2')
  })

  it('finishConnection on same direction pin cancels', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 0, 0, [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', 200, 0, [], [{ id: 'out2', type: 'exec' }]))
    const { result } = renderHook(() => useConnection(store))
    act(() => {
      result.current.startConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    act(() => {
      result.current.finishConnection({
        nodeId: 'n2', pinId: 'out2', isOutput: true, pos: { x: 200, y: 100 },
      })
    })
    expect(store.getConnections()).toHaveLength(0)
    expect(result.current.draft).toBeNull()
  })
})
