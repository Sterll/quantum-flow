import { useCallback, useRef } from 'react'
import type { GraphStore } from '../model/GraphStore'
import { useViewport, type ViewportAPI } from './useViewport'
import { useNodeDrag, type NodeDragAPI } from './useNodeDrag'
import { useConnection, type ConnectionAPI } from './useConnection'
import { useSelection, type SelectionAPI } from './useSelection'
import { useHotkeys } from './useHotkeys'
import { hitTestPin, hitTestNode, nodeHeight } from './hitTest'

const NODE_W = 220
const ZOOM_FACTOR = 1.1

export interface CanvasInteractionOptions {
  readOnly?: boolean
  snapToGrid?: number
  onSelectionChange?: (ids: Set<string>) => void
}

export interface CanvasInteractionAPI {
  viewport: ViewportAPI
  selection: SelectionAPI
  nodeDrag: NodeDragAPI
  connection: ConnectionAPI
  needsRedraw: React.MutableRefObject<boolean>
  attach(canvas: HTMLCanvasElement): () => void
}

export function useCanvasInteraction(
  store: GraphStore,
  options?: CanvasInteractionOptions,
): CanvasInteractionAPI {
  const needsRedraw = useRef(true)

  const viewport = useViewport()
  const selection = useSelection({ onSelectionChange: options?.onSelectionChange })
  const nodeDrag = useNodeDrag(store, viewport, {
    selected: selection.selected,
    snapToGrid: options?.snapToGrid,
  })
  const connection = useConnection(store)
  const hotkeys = useHotkeys(store, {
    selected: selection.selected,
    clearSelection: selection.clear,
    selectAll: selection.selectAll,
    readOnly: options?.readOnly,
  })

  // Refs to track current state (avoid stale closures in event handlers)
  const draggingRef = useRef(nodeDrag.dragging)
  draggingRef.current = nodeDrag.dragging

  const draftRef = useRef(connection.draft)
  draftRef.current = connection.draft

  const selectedRef = useRef(selection.selected)
  selectedRef.current = selection.selected

  // Rubber-band drag state (not in a hook — local refs)
  const rubberStart = useRef<{ x: number; y: number } | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  const markDirty = useCallback(() => {
    needsRedraw.current = true
  }, [])

  const attach = useCallback((canvas: HTMLCanvasElement): (() => void) => {
    const getWorldPos = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      return { screen: { x: sx, y: sy }, world: viewport.screenToWorld(sx, sy) }
    }

    const onMouseDown = (e: MouseEvent) => {
      if (options?.readOnly) return

      // Right-click → pan
      if (e.button === 2) {
        isPanning.current = true
        panStart.current = { x: e.clientX, y: e.clientY }
        canvas.style.cursor = 'grabbing'
        markDirty()
        return
      }

      if (e.button !== 0) return

      const { world } = getWorldPos(e)
      const nodes = store.getNodes()

      // Check pins first
      const pinHit = hitTestPin(world, nodes)
      if (pinHit) {
        connection.startConnection(pinHit)
        markDirty()
        return
      }

      // Check nodes
      const nodeHit = hitTestNode(world, nodes)
      if (nodeHit) {
        if (e.shiftKey) {
          selection.toggle(nodeHit.id)
        } else if (!selectedRef.current.has(nodeHit.id)) {
          selection.select(nodeHit.id)
        }
        nodeDrag.startDrag(nodeHit.id, world)
        canvas.style.cursor = 'grabbing'
        markDirty()
        return
      }

      // Empty canvas click — start rubber-band or clear selection
      if (!e.shiftKey) {
        selection.clear()
      }
      rubberStart.current = world
      markDirty()
    }

    const onMouseMove = (e: MouseEvent) => {
      // Panning uses raw client coordinates, no world needed
      if (isPanning.current) {
        const dx = e.clientX - panStart.current.x
        const dy = e.clientY - panStart.current.y
        panStart.current = { x: e.clientX, y: e.clientY }
        viewport.pan(dx, dy)
        markDirty()
        return
      }

      const { world } = getWorldPos(e)

      // Node dragging
      if (draggingRef.current) {
        nodeDrag.moveDrag(world)
        markDirty()
        return
      }

      // Connection dragging
      if (draftRef.current) {
        connection.updateDraft(world)
        markDirty()
        return
      }

      // Rubber-band
      if (rubberStart.current) {
        const rx = Math.min(rubberStart.current.x, world.x)
        const ry = Math.min(rubberStart.current.y, world.y)
        const rw = Math.abs(world.x - rubberStart.current.x)
        const rh = Math.abs(world.y - rubberStart.current.y)
        selection.setRubberBand({ x: rx, y: ry, w: rw, h: rh })

        // Select nodes inside rubber-band
        const currentNodes = store.getNodes()
        const inside = currentNodes.filter(n => {
          const nw = n.width ?? NODE_W
          const nh = nodeHeight(n)
          return n.position.x + nw > rx && n.position.x < rx + rw
            && n.position.y + nh > ry && n.position.y < ry + rh
        })
        selection.selectAll(inside.map(n => n.id))
        markDirty()
        return
      }

      // Hover cursor
      if (options?.readOnly) return
      const nodes = store.getNodes()
      const pin = hitTestPin(world, nodes)
      if (pin) {
        canvas.style.cursor = 'crosshair'
        return
      }
      const node = hitTestNode(world, nodes)
      canvas.style.cursor = node ? 'grab' : 'default'
    }

    const onMouseUp = (e: MouseEvent) => {
      // End pan
      if (isPanning.current) {
        isPanning.current = false
        canvas.style.cursor = 'default'
        markDirty()
        return
      }

      // End node drag
      if (draggingRef.current) {
        nodeDrag.endDrag()
        canvas.style.cursor = 'grab'
        markDirty()
        return
      }

      // End connection
      if (draftRef.current) {
        const { world } = getWorldPos(e)
        const nodes = store.getNodes()
        const pinHit = hitTestPin(world, nodes)
        if (pinHit) {
          connection.finishConnection(pinHit)
        } else {
          connection.cancelConnection()
        }
        markDirty()
        return
      }

      // End rubber-band
      if (rubberStart.current) {
        rubberStart.current = null
        selection.clearRubberBand()
        markDirty()
        return
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const direction = e.deltaY < 0 ? 1 : -1
      const newZoom = viewport.ref.current.zoom * (direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR)
      viewport.zoomAt(newZoom, sx, sy)
      markDirty()
    }

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      hotkeys.handleKeyDown(e)
      markDirty()
    }

    /* ── Touch support ── */

    // Track pinch state for two-finger zoom
    const pinchState = { active: false, initialDist: 0, initialZoom: 1 }
    const lastTouchPos = { value: null as { x: number; y: number } | null }

    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

    const onTouchStart = (e: TouchEvent) => {
      if (options?.readOnly && e.touches.length === 1) return

      // Two-finger pinch-zoom
      if (e.touches.length === 2) {
        e.preventDefault()
        pinchState.active = true
        pinchState.initialDist = getTouchDist(e.touches[0], e.touches[1])
        pinchState.initialZoom = viewport.ref.current.zoom
        // Also use two-finger for panning
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        panStart.current = { x: midX, y: midY }
        isPanning.current = true
        return
      }

      if (e.touches.length !== 1) return
      e.preventDefault()

      const touch = e.touches[0]
      const { world } = getWorldPos(touch)
      const nodes = store.getNodes()

      // Check pins
      const pinHit = hitTestPin(world, nodes)
      if (pinHit) {
        connection.startConnection(pinHit)
        markDirty()
        return
      }

      // Check nodes
      const nodeHit = hitTestNode(world, nodes)
      if (nodeHit) {
        if (!selectedRef.current.has(nodeHit.id)) {
          selection.select(nodeHit.id)
        }
        nodeDrag.startDrag(nodeHit.id, world)
        markDirty()
        return
      }

      // Empty area - clear selection
      selection.clear()
      lastTouchPos.value = { x: touch.clientX, y: touch.clientY }
      isPanning.current = true
      panStart.current = { x: touch.clientX, y: touch.clientY }
      markDirty()
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()

      // Two-finger pinch-zoom
      if (e.touches.length === 2 && pinchState.active) {
        const dist = getTouchDist(e.touches[0], e.touches[1])
        const scale = dist / pinchState.initialDist
        const rect = canvas.getBoundingClientRect()
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
        viewport.zoomAt(pinchState.initialZoom * scale, midX, midY)

        // Pan with midpoint
        const currentMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const currentMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const dx = currentMidX - panStart.current.x
        const dy = currentMidY - panStart.current.y
        panStart.current = { x: currentMidX, y: currentMidY }
        viewport.pan(dx, dy)
        markDirty()
        return
      }

      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      const { world } = getWorldPos(touch)

      // Node dragging
      if (draggingRef.current) {
        nodeDrag.moveDrag(world)
        markDirty()
        return
      }

      // Connection dragging
      if (draftRef.current) {
        connection.updateDraft(world)
        markDirty()
        return
      }

      // Single-finger pan on empty area
      if (isPanning.current) {
        const dx = touch.clientX - panStart.current.x
        const dy = touch.clientY - panStart.current.y
        panStart.current = { x: touch.clientX, y: touch.clientY }
        viewport.pan(dx, dy)
        markDirty()
        return
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      // End pinch
      if (pinchState.active && e.touches.length < 2) {
        pinchState.active = false
        if (e.touches.length === 0) {
          isPanning.current = false
        }
        markDirty()
        return
      }

      if (e.touches.length > 0) return

      // End node drag
      if (draggingRef.current) {
        nodeDrag.endDrag()
        markDirty()
        return
      }

      // End connection
      if (draftRef.current) {
        if (e.changedTouches.length > 0) {
          const touch = e.changedTouches[0]
          const { world } = getWorldPos(touch)
          const nodes = store.getNodes()
          const pinHit = hitTestPin(world, nodes)
          if (pinHit) {
            connection.finishConnection(pinHit)
          } else {
            connection.cancelConnection()
          }
        } else {
          connection.cancelConnection()
        }
        markDirty()
        return
      }

      // End pan
      isPanning.current = false
      lastTouchPos.value = null
      markDirty()
    }

    /* ── Attach all listeners ── */

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onContextMenu)
    canvas.setAttribute('tabindex', '0')
    canvas.addEventListener('keydown', onKeyDown)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [store, viewport, nodeDrag, connection, selection, hotkeys, options?.readOnly, markDirty])

  return { viewport, selection, nodeDrag, connection, needsRedraw, attach }
}
