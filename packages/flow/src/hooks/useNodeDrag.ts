import { useState, useRef, useCallback } from 'react'
import type { GraphStore } from '../model/GraphStore'
import type { ViewportAPI } from './useViewport'
import { nodeHeight, GROUP_NODE_TYPE } from './hitTest'
import { NODE_W } from '../constants'

interface Vec2 { x: number; y: number }

export interface AlignmentGuide {
  orientation: 'horizontal' | 'vertical'
  worldCoord: number
  start: number
  end: number
}

export interface NodeDragOptions {
  selected?: Set<string>
  snapToGrid?: number
  snapToAlignment?: boolean
  alignThreshold?: number
}

export interface NodeDragAPI {
  dragging: string | null
  startDrag(nodeId: string, worldPos: Vec2): void
  moveDrag(worldPos: Vec2): void
  endDrag(): void
  alignmentGuides: React.MutableRefObject<AlignmentGuide[]>
}

export function useNodeDrag(
  store: GraphStore,
  _viewport: ViewportAPI,
  options?: NodeDragOptions,
): NodeDragAPI {
  const [dragging, setDragging] = useState<string | null>(null)
  const grabOffset = useRef<Map<string, Vec2>>(new Map())
  const draggingRef = useRef<string | null>(null)
  const alignmentGuides = useRef<AlignmentGuide[]>([])

  const snap = useCallback((v: number): number => {
    const grid = options?.snapToGrid
    if (!grid || grid <= 0) return v
    return Math.round(v / grid) * grid
  }, [options?.snapToGrid])

  const startDrag = useCallback((nodeId: string, worldPos: Vec2) => {
    setDragging(nodeId)
    draggingRef.current = nodeId
    grabOffset.current.clear()
    const selected = options?.selected
    const dragIds = selected && selected.has(nodeId) ? Array.from(selected) : [nodeId]

    // Expand group children into drag set
    const expandedIds = new Set(dragIds)
    for (const id of dragIds) {
      const node = store.getNode(id)
      if (node && node.type === GROUP_NODE_TYPE) {
        const childIds = (node.data.childIds as string[]) ?? []
        for (const cid of childIds) expandedIds.add(cid)
      }
    }

    for (const id of expandedIds) {
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
    const threshold = options?.alignThreshold ?? 5

    // Compute tentative positions
    const tentative = new Map<string, Vec2>()
    for (const [id, offset] of grabOffset.current) {
      tentative.set(id, {
        x: snap(worldPos.x - offset.x),
        y: snap(worldPos.y - offset.y),
      })
    }

    // Alignment snapping
    if (options?.snapToAlignment) {
      const allNodes = store.getNodes()
      const dragIds = new Set(grabOffset.current.keys())
      const staticNodes = allNodes.filter(n => !dragIds.has(n.id))

      const primaryId = draggingRef.current
      const primaryPos = primaryId ? tentative.get(primaryId) : null
      const primaryNode = primaryId ? allNodes.find(n => n.id === primaryId) : null

      if (primaryPos && primaryNode) {
        const pw = primaryNode.width ?? NODE_W
        const ph = nodeHeight(primaryNode)
        const guides: AlignmentGuide[] = []
        let snapDx = 0, snapDy = 0

        // Collect static edges
        const staticXs: number[] = []
        const staticYs: number[] = []
        for (const n of staticNodes) {
          const nw = n.width ?? NODE_W
          const nh = nodeHeight(n)
          staticXs.push(n.position.x, n.position.x + nw / 2, n.position.x + nw)
          staticYs.push(n.position.y, n.position.y + nh / 2, n.position.y + nh)
        }

        // Primary edges: left, center, right
        const pxEdges = [primaryPos.x, primaryPos.x + pw / 2, primaryPos.x + pw]
        for (const pe of pxEdges) {
          for (const se of staticXs) {
            if (Math.abs(pe - se) <= threshold) {
              snapDx = se - pe
              const allY = [primaryPos.y, primaryPos.y + ph, ...staticNodes.map(n => n.position.y), ...staticNodes.map(n => n.position.y + nodeHeight(n))]
              guides.push({ orientation: 'vertical', worldCoord: se, start: Math.min(...allY) - 10, end: Math.max(...allY) + 10 })
              break
            }
          }
          if (snapDx !== 0) break
        }

        // Primary edges: top, center, bottom
        const pyEdges = [primaryPos.y, primaryPos.y + ph / 2, primaryPos.y + ph]
        for (const pe of pyEdges) {
          for (const se of staticYs) {
            if (Math.abs(pe - se) <= threshold) {
              snapDy = se - pe
              const allX = [primaryPos.x, primaryPos.x + pw, ...staticNodes.map(n => n.position.x), ...staticNodes.map(n => n.position.x + (n.width ?? NODE_W))]
              guides.push({ orientation: 'horizontal', worldCoord: se, start: Math.min(...allX) - 10, end: Math.max(...allX) + 10 })
              break
            }
          }
          if (snapDy !== 0) break
        }

        // Apply snap delta
        if (snapDx !== 0 || snapDy !== 0) {
          for (const [id, pos] of tentative) {
            tentative.set(id, { x: pos.x + snapDx, y: pos.y + snapDy })
          }
        }

        alignmentGuides.current = guides
      } else {
        alignmentGuides.current = []
      }
    } else {
      alignmentGuides.current = []
    }

    // Commit positions (batched to avoid N history snapshots per frame)
    store.batch(() => {
      for (const [id, pos] of tentative) {
        store.moveNode(id, pos)
      }
    })
  }, [store, snap, options?.snapToAlignment, options?.alignThreshold])

  const endDrag = useCallback(() => {
    setDragging(null)
    draggingRef.current = null
    grabOffset.current.clear()
    alignmentGuides.current = []
  }, [])

  return { dragging, startDrag, moveDrag, endDrag, alignmentGuides }
}
