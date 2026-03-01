import { useState, useRef, useCallback } from 'react'
import type { GraphStore } from '../model/GraphStore'
import type { ViewportAPI } from './useViewport'

interface Vec2 { x: number; y: number }

export interface NodeDragOptions {
  selected?: Set<string>
  snapToGrid?: number
}

export interface NodeDragAPI {
  dragging: string | null
  startDrag(nodeId: string, worldPos: Vec2): void
  moveDrag(worldPos: Vec2): void
  endDrag(): void
}

export function useNodeDrag(
  store: GraphStore,
  _viewport: ViewportAPI,
  options?: NodeDragOptions,
): NodeDragAPI {
  const [dragging, setDragging] = useState<string | null>(null)
  const grabOffset = useRef<Map<string, Vec2>>(new Map())

  const snap = useCallback((v: number): number => {
    const grid = options?.snapToGrid
    if (!grid || grid <= 0) return v
    return Math.round(v / grid) * grid
  }, [options?.snapToGrid])

  const startDrag = useCallback((nodeId: string, worldPos: Vec2) => {
    setDragging(nodeId)
    grabOffset.current.clear()
    const selected = options?.selected
    const dragIds = selected && selected.has(nodeId) ? Array.from(selected) : [nodeId]
    for (const id of dragIds) {
      const node = store.getNode(id)
      if (node) {
        grabOffset.current.set(id, {
          x: worldPos.x - node.position.x,
          y: worldPos.y - node.position.y,
        })
      }
    }
  }, [store, options?.selected])

  const moveDrag = useCallback((worldPos: Vec2) => {
    for (const [id, offset] of grabOffset.current) {
      store.moveNode(id, {
        x: snap(worldPos.x - offset.x),
        y: snap(worldPos.y - offset.y),
      })
    }
  }, [store, snap])

  const endDrag = useCallback(() => {
    setDragging(null)
    grabOffset.current.clear()
  }, [])

  return { dragging, startDrag, moveDrag, endDrag }
}
