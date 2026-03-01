import { useState, useCallback, useRef, useEffect } from 'react'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface SelectionOptions {
  onSelectionChange?: (selected: Set<string>) => void
}

export interface SelectionAPI {
  selected: Set<string>
  rubberBand: Rect | null
  select(nodeId: string): void
  toggle(nodeId: string): void
  clear(): void
  selectAll(nodeIds: string[]): void
  setRubberBand(rect: Rect): void
  clearRubberBand(): void
}

export function useSelection(options?: SelectionOptions): SelectionAPI {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rubberBand, setRubberBandState] = useState<Rect | null>(null)
  const cbRef = useRef(options?.onSelectionChange)
  cbRef.current = options?.onSelectionChange

  useEffect(() => {
    cbRef.current?.(selected)
  }, [selected])

  const select = useCallback((nodeId: string) => {
    setSelected(new Set([nodeId]))
  }, [])

  const toggle = useCallback((nodeId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) { next.delete(nodeId) } else { next.add(nodeId) }
      return next
    })
  }, [])

  const clear = useCallback(() => { setSelected(new Set()) }, [])

  const selectAll = useCallback((nodeIds: string[]) => {
    setSelected(new Set(nodeIds))
  }, [])

  const setRubberBand = useCallback((rect: Rect) => { setRubberBandState(rect) }, [])
  const clearRubberBand = useCallback(() => { setRubberBandState(null) }, [])

  return { selected, rubberBand, select, toggle, clear, selectAll, setRubberBand, clearRubberBand }
}
