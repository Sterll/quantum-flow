import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipboard } from '../src/react/useClipboard'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowNode, FlowConnection } from '../src/types'

const makeNode = (id: string, x = 0, y = 0): FlowNode => ({
  id, type: 'test/node', label: id,
  position: { x, y }, inputs: [], outputs: [], data: {},
})

const makeNodeWithPins = (id: string, x = 0, y = 0): FlowNode => ({
  id, type: 'test/node', label: id,
  position: { x, y },
  inputs: [{ id: 'in', type: 'exec', label: '' }],
  outputs: [{ id: 'out', type: 'exec', label: '' }],
  data: {},
})

const makeConnection = (id: string, from: string, to: string): FlowConnection => ({
  id, fromNodeId: from, fromPinId: 'out', toNodeId: to, toPinId: 'in',
})

describe('useClipboard', () => {
  it('starts with canPaste=false', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useClipboard(store))
    expect(result.current.canPaste).toBe(false)
  })

  it('copy fills buffer and sets canPaste=true', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const { result } = renderHook(() => useClipboard(store))
    act(() => {
      result.current.copy(new Set(['n1']))
    })
    expect(result.current.canPaste).toBe(true)
  })

  it('copy ignores unknown node ids', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const { result } = renderHook(() => useClipboard(store))
    act(() => {
      result.current.copy(['n1', 'nonexistent'])
    })
    expect(result.current.canPaste).toBe(true)
  })

  it('paste duplicates nodes with new IDs and offset', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 200))
    const { result } = renderHook(() => useClipboard(store))
    act(() => {
      result.current.copy(['n1'])
    })
    let pasted: FlowNode[] = []
    act(() => {
      pasted = result.current.paste()
    })
    expect(pasted).toHaveLength(1)
    expect(pasted[0].id).not.toBe('n1')
    expect(pasted[0].position).toEqual({ x: 120, y: 220 })
    expect(pasted[0].label).toBe('n1')
    expect(store.getNodes()).toHaveLength(2)
  })

  it('paste applies custom offset', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 50, 50))
    const { result } = renderHook(() => useClipboard(store))
    act(() => {
      result.current.copy(['n1'])
    })
    let pasted: FlowNode[] = []
    act(() => {
      pasted = result.current.paste({ x: 100, y: 0 })
    })
    expect(pasted[0].position).toEqual({ x: 150, y: 50 })
  })

  it('paste copies internal connections with remapped IDs', () => {
    const store = new GraphStore()
    store.addNode(makeNodeWithPins('n1'))
    store.addNode(makeNodeWithPins('n2'))
    store.addConnection(makeConnection('c1', 'n1', 'n2'))
    const { result } = renderHook(() => useClipboard(store))

    act(() => {
      result.current.copy(['n1', 'n2'])
    })
    let pasted: FlowNode[] = []
    act(() => {
      pasted = result.current.paste()
    })
    expect(pasted).toHaveLength(2)
    expect(store.getNodes()).toHaveLength(4)
    expect(store.getConnections()).toHaveLength(2)
    const newConn = store.getConnections().find(c => c.id !== 'c1')!
    expect(newConn.fromNodeId).not.toBe('n1')
    expect(newConn.toNodeId).not.toBe('n2')
    expect(pasted.map(n => n.id)).toContain(newConn.fromNodeId)
    expect(pasted.map(n => n.id)).toContain(newConn.toNodeId)
  })

  it('paste does not copy external connections', () => {
    const store = new GraphStore()
    store.addNode(makeNodeWithPins('n1'))
    store.addNode(makeNodeWithPins('n2'))
    store.addNode(makeNodeWithPins('n3'))
    store.addConnection(makeConnection('c1', 'n1', 'n2'))
    store.addConnection(makeConnection('c2', 'n2', 'n3'))
    const { result } = renderHook(() => useClipboard(store))

    act(() => {
      result.current.copy(['n1', 'n2'])
    })
    act(() => {
      result.current.paste()
    })
    expect(store.getNodes()).toHaveLength(5)
    expect(store.getConnections()).toHaveLength(3)
  })

  it('cut removes original nodes and fills buffer', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    const { result } = renderHook(() => useClipboard(store))

    act(() => {
      result.current.cut(new Set(['n1']))
    })
    expect(store.getNodes()).toHaveLength(1)
    expect(store.getNodes()[0].id).toBe('n2')
    expect(result.current.canPaste).toBe(true)
  })

  it('paste can be called multiple times', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const { result } = renderHook(() => useClipboard(store))

    act(() => {
      result.current.copy(['n1'])
    })
    act(() => {
      result.current.paste()
    })
    act(() => {
      result.current.paste()
    })
    expect(store.getNodes()).toHaveLength(3)
  })

  it('paste returns empty array when buffer is empty', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useClipboard(store))
    let pasted: FlowNode[] = []
    act(() => {
      pasted = result.current.paste()
    })
    expect(pasted).toEqual([])
  })

  it('accepts string array for nodeIds', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const { result } = renderHook(() => useClipboard(store))
    act(() => {
      result.current.copy(['n1'])
    })
    expect(result.current.canPaste).toBe(true)
  })
})
