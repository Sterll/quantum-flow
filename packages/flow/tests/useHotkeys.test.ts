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

  /* -- Tab: cycle through nodes -- */

  it('Tab selects first node when nothing is selected', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    const selected = new Set<string>()
    const select = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), select }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(select).toHaveBeenCalledWith('n1')
  })

  it('Tab cycles to next node', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    store.addNode(makeNode('n3'))
    const selected = new Set(['n1'])
    const select = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), select }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(select).toHaveBeenCalledWith('n2')
  })

  it('Tab wraps around from last to first node', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    const selected = new Set(['n2'])
    const select = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), select }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(select).toHaveBeenCalledWith('n1')
  })

  it('Shift+Tab cycles backwards', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    store.addNode(makeNode('n3'))
    const selected = new Set(['n2'])
    const select = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), select }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
    expect(select).toHaveBeenCalledWith('n1')
  })

  it('Shift+Tab wraps from first to last', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    const selected = new Set(['n1'])
    const select = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), select }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
    expect(select).toHaveBeenCalledWith('n2')
  })

  /* -- Arrow keys: move selected nodes -- */

  it('ArrowRight calls onMoveSelected with positive dx', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const selected = new Set(['n1'])
    const onMoveSelected = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), onMoveSelected }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(onMoveSelected).toHaveBeenCalledWith(24, 0)
  })

  it('ArrowLeft calls onMoveSelected with negative dx', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const selected = new Set(['n1'])
    const onMoveSelected = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), onMoveSelected }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(onMoveSelected).toHaveBeenCalledWith(-24, 0)
  })

  it('ArrowDown calls onMoveSelected with positive dy', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const selected = new Set(['n1'])
    const onMoveSelected = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), onMoveSelected }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(onMoveSelected).toHaveBeenCalledWith(0, 24)
  })

  it('Shift+Arrow uses 1px step instead of grid', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const selected = new Set(['n1'])
    const onMoveSelected = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), onMoveSelected }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true }))
    expect(onMoveSelected).toHaveBeenCalledWith(1, 0)
  })

  it('Arrow keys do nothing when no node is selected', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const selected = new Set<string>()
    const onMoveSelected = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), onMoveSelected }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(onMoveSelected).not.toHaveBeenCalled()
  })

  /* -- Escape: clear selection -- */

  it('Escape clears selection', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const selected = new Set(['n1'])
    const clearSelection = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(clearSelection).toHaveBeenCalled()
  })

  it('Escape does nothing when selection is empty', () => {
    const store = new GraphStore()
    const selected = new Set<string>()
    const clearSelection = vi.fn()
    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(clearSelection).not.toHaveBeenCalled()
  })
})
