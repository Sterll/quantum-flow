import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewport } from '../src/hooks/useViewport'

describe('useViewport', () => {
  it('starts with default offset {0,0} and zoom 1', () => {
    const { result } = renderHook(() => useViewport())
    expect(result.current.ref.current.offset).toEqual({ x: 0, y: 0 })
    expect(result.current.ref.current.zoom).toBe(1)
  })

  it('screenToWorld converts screen coords to world coords', () => {
    const { result } = renderHook(() => useViewport())
    const world = result.current.screenToWorld(100, 200)
    expect(world.x).toBe(100)
    expect(world.y).toBe(200)
  })

  it('screenToWorld accounts for offset and zoom', () => {
    const { result } = renderHook(() => useViewport())
    act(() => {
      result.current.ref.current.offset = { x: 50, y: 50 }
      result.current.ref.current.zoom = 2
    })
    const world = result.current.screenToWorld(150, 250)
    expect(world.x).toBe(50)
    expect(world.y).toBe(100)
  })

  it('worldToScreen converts world coords to screen coords', () => {
    const { result } = renderHook(() => useViewport())
    act(() => {
      result.current.ref.current.offset = { x: 50, y: 50 }
      result.current.ref.current.zoom = 2
    })
    const screen = result.current.worldToScreen(50, 100)
    expect(screen.x).toBe(150)
    expect(screen.y).toBe(250)
  })

  it('pan updates offset', () => {
    const { result } = renderHook(() => useViewport())
    act(() => {
      result.current.pan(30, -20)
    })
    expect(result.current.ref.current.offset).toEqual({ x: 30, y: -20 })
  })

  it('zoomAt adjusts zoom and offset to keep point stable', () => {
    const { result } = renderHook(() => useViewport())
    act(() => {
      result.current.zoomAt(1.5, 100, 100)
    })
    expect(result.current.ref.current.zoom).toBe(1.5)
    expect(result.current.ref.current.offset.x).toBe(-50)
    expect(result.current.ref.current.offset.y).toBe(-50)
  })

  it('clamps zoom between 0.1 and 3.0', () => {
    const { result } = renderHook(() => useViewport())
    act(() => {
      result.current.zoomAt(0.01, 0, 0)
    })
    expect(result.current.ref.current.zoom).toBe(0.1)

    act(() => {
      result.current.zoomAt(5, 0, 0)
    })
    expect(result.current.ref.current.zoom).toBe(3.0)
  })
})
