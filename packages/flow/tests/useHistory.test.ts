import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHistory } from '../src/react/useHistory'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowNode } from '../src/types'

const makeNode = (id: string): FlowNode => ({
  id, type: 'test/node', label: id,
  position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
})

describe('useHistory', () => {
  it('starts with canUndo=false and canRedo=false', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('canUndo becomes true after a store mutation', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store))
    act(() => {
      store.addNode(makeNode('n1'))
    })
    expect(result.current.canUndo).toBe(true)
  })

  it('undo restores previous state and updates canUndo/canRedo', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store))
    act(() => {
      store.addNode(makeNode('n1'))
    })
    expect(store.getNodes()).toHaveLength(1)

    act(() => {
      result.current.undo()
    })
    expect(store.getNodes()).toHaveLength(0)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it('redo re-applies the undone change', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store))
    act(() => {
      store.addNode(makeNode('n1'))
    })
    act(() => {
      result.current.undo()
    })
    act(() => {
      result.current.redo()
    })
    expect(store.getNodes()).toHaveLength(1)
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('exposes the HistoryManager instance', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store))
    expect(result.current.history).toBeDefined()
    expect(typeof result.current.history.getUndoStack).toBe('function')
  })

  it('respects maxSize option', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store, { maxSize: 3 }))
    act(() => {
      store.addNode(makeNode('n1'))
      store.addNode(makeNode('n2'))
      store.addNode(makeNode('n3'))
      store.addNode(makeNode('n4'))
    })
    // maxSize=3 means stack is trimmed (initial + 4 adds, trimmed to 3)
    const stack = result.current.history.getUndoStack()
    expect(stack.length).toBeLessThanOrEqual(3)
  })

  it('returns same instance across re-renders', () => {
    const store = new GraphStore()
    const { result, rerender } = renderHook(() => useHistory(store))
    const first = result.current.history
    rerender()
    expect(result.current.history).toBe(first)
  })
})
