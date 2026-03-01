import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFlowEditor } from '../src/react/useFlowEditor'
import { defineNode } from '../src/define/defineNode'
import type { FlowGraph, FlowNode, FlowConnection } from '../src/types'

const makeNode = (id: string): FlowNode => ({
  id, type: 'test/node', label: id,
  position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
})

const makeConnection = (id: string, from: string, fromPin: string, to: string, toPin: string): FlowConnection => ({
  id, fromNodeId: from, fromPinId: fromPin, toNodeId: to, toPinId: toPin,
})

describe('useFlowEditor', () => {
  it('creates a store with no options', () => {
    const { result } = renderHook(() => useFlowEditor())
    expect(result.current.store).toBeDefined()
    expect(result.current.store.getNodes()).toEqual([])
  })

  it('imports initialGraph', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('n1')],
      connections: [],
    }
    const { result } = renderHook(() => useFlowEditor({ initialGraph: graph }))
    expect(result.current.store.getNodes()).toHaveLength(1)
  })

  it('addNode proxies to store', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    expect(result.current.store.getNodes()).toHaveLength(1)
  })

  it('removeNode proxies to store', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    act(() => {
      result.current.removeNode('n1')
    })
    expect(result.current.store.getNodes()).toHaveLength(0)
  })

  it('addConnection and removeConnection proxy to store', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode({
        ...makeNode('n1'),
        outputs: [{ id: 'out', type: 'exec', label: '' }],
      })
      result.current.addNode({
        ...makeNode('n2'),
        inputs: [{ id: 'in', type: 'exec', label: '' }],
      })
      result.current.addConnection(makeConnection('c1', 'n1', 'out', 'n2', 'in'))
    })
    expect(result.current.store.getConnections()).toHaveLength(1)

    act(() => {
      result.current.removeConnection('c1')
    })
    expect(result.current.store.getConnections()).toHaveLength(0)
  })

  it('history is enabled by default with undo/redo', () => {
    const { result } = renderHook(() => useFlowEditor())
    expect(result.current.canUndo).toBe(false)

    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    expect(result.current.canUndo).toBe(true)

    act(() => {
      result.current.undo()
    })
    expect(result.current.store.getNodes()).toHaveLength(0)
    expect(result.current.canRedo).toBe(true)

    act(() => {
      result.current.redo()
    })
    expect(result.current.store.getNodes()).toHaveLength(1)
  })

  it('history: false disables undo/redo', () => {
    const { result } = renderHook(() => useFlowEditor({ history: false }))
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.undo()).toBe(false)
  })

  it('toJSON returns current graph state', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    const json = result.current.toJSON()
    expect(json.nodes).toHaveLength(1)
    expect(json.connections).toEqual([])
  })

  it('fromJSON replaces graph state', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    act(() => {
      result.current.fromJSON({
        nodes: [makeNode('n2'), makeNode('n3')],
        connections: [],
      })
    })
    expect(result.current.store.getNodes()).toHaveLength(2)
    expect(result.current.store.getNode('n1')).toBeUndefined()
    expect(result.current.store.getNode('n2')).toBeDefined()
  })

  it('registry is populated when definitions provided', () => {
    const branchNode = defineNode({
      type: 'logic/branch', label: 'Branch',
      inputs: [{ id: 'exec', type: 'exec', label: '' }],
      outputs: [{ id: 'true', type: 'exec', label: 'True' }, { id: 'false', type: 'exec', label: 'False' }],
    })
    const { result } = renderHook(() => useFlowEditor({ registry: [branchNode] }))
    expect(result.current.registry).not.toBeNull()
    expect(result.current.registry!.has('logic/branch')).toBe(true)
  })

  it('registry is null when no definitions provided', () => {
    const { result } = renderHook(() => useFlowEditor())
    expect(result.current.registry).toBeNull()
  })

  it('returns stable references across re-renders', () => {
    const { result, rerender } = renderHook(() => useFlowEditor())
    const first = result.current
    rerender()
    expect(result.current.store).toBe(first.store)
    expect(result.current.addNode).toBe(first.addNode)
    expect(result.current.toJSON).toBe(first.toJSON)
  })
})
