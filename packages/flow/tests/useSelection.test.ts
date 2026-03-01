import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSelection } from '../src/hooks/useSelection'

describe('useSelection', () => {
  it('starts with empty selection', () => {
    const { result } = renderHook(() => useSelection())
    expect(result.current.selected.size).toBe(0)
  })

  it('select replaces the selection with a single node', () => {
    const { result } = renderHook(() => useSelection())
    act(() => { result.current.select('n1') })
    expect(result.current.selected.has('n1')).toBe(true)
    expect(result.current.selected.size).toBe(1)
  })

  it('select replaces previous selection', () => {
    const { result } = renderHook(() => useSelection())
    act(() => { result.current.select('n1') })
    act(() => { result.current.select('n2') })
    expect(result.current.selected.has('n1')).toBe(false)
    expect(result.current.selected.has('n2')).toBe(true)
  })

  it('toggle adds to selection', () => {
    const { result } = renderHook(() => useSelection())
    act(() => { result.current.select('n1') })
    act(() => { result.current.toggle('n2') })
    expect(result.current.selected.has('n1')).toBe(true)
    expect(result.current.selected.has('n2')).toBe(true)
  })

  it('toggle removes if already selected', () => {
    const { result } = renderHook(() => useSelection())
    act(() => { result.current.select('n1') })
    act(() => { result.current.toggle('n1') })
    expect(result.current.selected.has('n1')).toBe(false)
  })

  it('clear empties the selection', () => {
    const { result } = renderHook(() => useSelection())
    act(() => { result.current.select('n1') })
    act(() => { result.current.clear() })
    expect(result.current.selected.size).toBe(0)
  })

  it('selectAll sets all provided IDs', () => {
    const { result } = renderHook(() => useSelection())
    act(() => { result.current.selectAll(['n1', 'n2', 'n3']) })
    expect(result.current.selected.size).toBe(3)
  })

  it('setRubberBand / clearRubberBand manage rubber-band rect', () => {
    const { result } = renderHook(() => useSelection())
    act(() => { result.current.setRubberBand({ x: 10, y: 20, w: 100, h: 50 }) })
    expect(result.current.rubberBand).toEqual({ x: 10, y: 20, w: 100, h: 50 })
    act(() => { result.current.clearRubberBand() })
    expect(result.current.rubberBand).toBeNull()
  })

  it('calls onSelectionChange callback when selection changes', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useSelection({ onSelectionChange: cb }))
    act(() => { result.current.select('n1') })
    expect(cb).toHaveBeenCalledWith(new Set(['n1']))
  })
})
