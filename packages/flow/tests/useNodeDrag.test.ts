import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNodeDrag } from '../src/hooks/useNodeDrag'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowNode } from '../src/types'
import type { ViewportAPI } from '../src/hooks/useViewport'

const makeNode = (id: string, x: number, y: number): FlowNode => ({
  id, type: 'test/node', label: id, position: { x, y }, inputs: [], outputs: [], data: {},
})

function makeViewport(offset = { x: 0, y: 0 }, zoom = 1): ViewportAPI {
  const ref = { current: { offset, zoom } }
  return {
    ref: ref as any,
    screenToWorld: (sx: number, sy: number) => ({
      x: (sx - ref.current.offset.x) / ref.current.zoom,
      y: (sy - ref.current.offset.y) / ref.current.zoom,
    }),
    worldToScreen: (wx: number, wy: number) => ({
      x: wx * ref.current.zoom + ref.current.offset.x,
      y: wy * ref.current.zoom + ref.current.offset.y,
    }),
    pan: vi.fn(),
    zoomAt: vi.fn(),
  }
}

describe('useNodeDrag', () => {
  it('starts with no dragging', () => {
    const store = new GraphStore()
    const vp = makeViewport()
    const { result } = renderHook(() => useNodeDrag(store, vp))
    expect(result.current.dragging).toBeNull()
  })

  it('startDrag sets dragging nodeId', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 100))
    const vp = makeViewport()
    const { result } = renderHook(() => useNodeDrag(store, vp))
    act(() => { result.current.startDrag('n1', { x: 120, y: 120 }) })
    expect(result.current.dragging).toBe('n1')
  })

  it('moveDrag updates node position in store', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 100))
    const vp = makeViewport()
    const { result } = renderHook(() => useNodeDrag(store, vp))
    act(() => { result.current.startDrag('n1', { x: 120, y: 120 }) })
    act(() => { result.current.moveDrag({ x: 150, y: 160 }) })
    const node = store.getNode('n1')!
    expect(node.position.x).toBe(130)
    expect(node.position.y).toBe(140)
  })

  it('endDrag clears dragging state', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 100))
    const vp = makeViewport()
    const { result } = renderHook(() => useNodeDrag(store, vp))
    act(() => { result.current.startDrag('n1', { x: 120, y: 120 }) })
    act(() => { result.current.endDrag() })
    expect(result.current.dragging).toBeNull()
  })

  it('multi-drag moves all selected nodes together', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 100))
    store.addNode(makeNode('n2', 300, 200))
    const vp = makeViewport()
    const selected = new Set(['n1', 'n2'])
    const { result } = renderHook(() => useNodeDrag(store, vp, { selected }))
    act(() => { result.current.startDrag('n1', { x: 120, y: 120 }) })
    act(() => { result.current.moveDrag({ x: 150, y: 160 }) })
    const n1 = store.getNode('n1')!
    const n2 = store.getNode('n2')!
    expect(n1.position).toEqual({ x: 130, y: 140 })
    expect(n2.position).toEqual({ x: 330, y: 240 })
  })

  it('snaps to grid when snapToGrid is set', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 100))
    const vp = makeViewport()
    const { result } = renderHook(() => useNodeDrag(store, vp, { snapToGrid: 20 }))
    act(() => { result.current.startDrag('n1', { x: 100, y: 100 }) })
    act(() => { result.current.moveDrag({ x: 113, y: 127 }) })
    const node = store.getNode('n1')!
    expect(node.position.x).toBe(120)
    expect(node.position.y).toBe(120)
  })
})
