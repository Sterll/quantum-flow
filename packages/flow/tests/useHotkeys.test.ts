import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHotkeys } from '../src/hooks/useHotkeys'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowNode } from '../src/types'

const makeNode = (id: string): FlowNode => ({
  id, type: 'test/node', label: id, position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
})

describe('useHotkeys', () => {
  it('handleKeyDown with Delete removes selected nodes', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    const selected = new Set(['n1'])
    const clearSelection = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }))
    expect(store.getNodes()).toHaveLength(1)
    expect(store.getNode('n1')).toBeUndefined()
    expect(clearSelection).toHaveBeenCalled()
  })

  it('handleKeyDown with Backspace also deletes', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const selected = new Set(['n1'])
    const clearSelection = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }))
    expect(store.getNodes()).toHaveLength(0)
  })

  it('handleKeyDown with Ctrl+A calls selectAll', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    const selected = new Set<string>()
    const selectAll = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), selectAll }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }))
    expect(selectAll).toHaveBeenCalledWith(['n1', 'n2'])
  })

  it('does nothing when readOnly is true', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const selected = new Set(['n1'])
    const clearSelection = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection, readOnly: true }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }))
    expect(store.getNodes()).toHaveLength(1)
    expect(clearSelection).not.toHaveBeenCalled()
  })

  it('delete batches removal of multiple selected nodes', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    store.addNode(makeNode('n3'))
    const selected = new Set(['n1', 'n2'])
    const clearSelection = vi.fn()
    const batchSpy = vi.spyOn(store, 'batch')
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }))
    expect(batchSpy).toHaveBeenCalled()
    expect(store.getNodes()).toHaveLength(1)
    expect(store.getNode('n3')).toBeDefined()
  })
})
