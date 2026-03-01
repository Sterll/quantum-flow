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

  // Rubber-band drag state (not in a hook — local refs)
  const rubberStart = useRef<{ x: number; y: number } | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  const markDirty = useCallback(() => {
    needsRedraw.current = true
  }, [])

  const attach = useCallback((canvas: HTMLCanvasElement): (() => void) => {
    const getWorldPos = (e: MouseEvent) => {
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
        } else if (!selection.selected.has(nodeHit.id)) {
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
      const { world } = getWorldPos(e)

      // Panning
      if (isPanning.current) {
        const dx = e.clientX - panStart.current.x
        const dy = e.clientY - panStart.current.y
        panStart.current = { x: e.clientX, y: e.clientY }
        viewport.pan(dx, dy)
        markDirty()
        return
      }

      // Node dragging
      if (nodeDrag.dragging) {
        nodeDrag.moveDrag(world)
        markDirty()
        return
      }

      // Connection dragging
      if (connection.draft) {
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
      if (nodeDrag.dragging) {
        nodeDrag.endDrag()
        canvas.style.cursor = 'grab'
        markDirty()
        return
      }

      // End connection
      if (connection.draft) {
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

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onContextMenu)
    canvas.setAttribute('tabindex', '0')
    canvas.addEventListener('keydown', onKeyDown)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('keydown', onKeyDown)
    }
  }, [store, viewport, nodeDrag, connection, selection, hotkeys, options?.readOnly, markDirty])

  return { viewport, selection, nodeDrag, connection, needsRedraw, attach }
}
