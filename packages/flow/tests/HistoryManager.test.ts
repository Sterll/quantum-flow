import { describe, it, expect } from 'vitest'
import { GraphStore } from '../src/model/GraphStore'
import { HistoryManager } from '../src/model/HistoryManager'
import type { FlowNode } from '../src/types'

const makeNode = (id: string): FlowNode => ({
  id, type: 'test/node', label: id, position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
})

describe('HistoryManager', () => {
  it('undo restores previous state', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.addNode(makeNode('n1'))
    expect(store.getNodes()).toHaveLength(1)
    history.undo()
    expect(store.getNodes()).toHaveLength(0)
  })

  it('redo restores undone state', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.addNode(makeNode('n1'))
    history.undo()
    expect(store.getNodes()).toHaveLength(0)
    history.redo()
    expect(store.getNodes()).toHaveLength(1)
  })

  it('canUndo/canRedo reflect state correctly', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    expect(history.canUndo()).toBe(false)
    store.addNode(makeNode('n1'))
    expect(history.canUndo()).toBe(true)
    expect(history.canRedo()).toBe(false)
    history.undo()
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(true)
  })

  it('captures initial state automatically on first mutation', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    history.undo()
    expect(store.getNodes()).toHaveLength(1)
    history.undo()
    expect(store.getNodes()).toHaveLength(0)
  })

  it('batch counts as a single undo step', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.batch(() => {
      store.addNode(makeNode('n1'))
      store.addNode(makeNode('n2'))
      store.addNode(makeNode('n3'))
    })
    expect(store.getNodes()).toHaveLength(3)
    history.undo()
    expect(store.getNodes()).toHaveLength(0)
  })

  it('respects maxSize limit', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store, { maxSize: 3 })
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    store.addNode(makeNode('n3'))
    store.addNode(makeNode('n4'))
    const undoStack = history.getUndoStack()
    expect(undoStack.length).toBeLessThanOrEqual(3)
  })

  it('getUndoStack returns labeled entries', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.addNode(makeNode('n1'))
    const stack = history.getUndoStack()
    expect(stack.length).toBeGreaterThan(0)
    expect(stack[stack.length - 1].label).toBeTruthy()
    expect(stack[stack.length - 1].timestamp).toBeGreaterThan(0)
  })

  it('clear resets history', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.addNode(makeNode('n1'))
    expect(history.canUndo()).toBe(true)
    history.clear()
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
  })
})
