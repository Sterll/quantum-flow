import { useCallback, useRef } from 'react'
import type { GraphStore } from '../model/GraphStore'
import type { FlowNode, FlowPin, FlowWaypoint } from '../types'
import { useViewport, type ViewportAPI } from './useViewport'
import { useNodeDrag, type NodeDragAPI, type AlignmentGuide } from './useNodeDrag'
import { useConnection, type ConnectionAPI, type DraftConnection } from './useConnection'
import { useSelection, type SelectionAPI, type Rect } from './useSelection'
import { useHotkeys } from './useHotkeys'
import { hitTestPin, hitTestNode, hitTestGroup, hitTestWaypoint, hitTestConnectionSegment, nodeHeight } from './hitTest'
import { NODE_W, SLOT_H, PIN_Y0 } from '../constants'

const ZOOM_FACTOR = 1.1

export interface HoverPin {
  nodeId: string
  pinId: string
  isOutput: boolean
}

export type ContextMenuTarget =
  | { type: 'node'; nodeId: string; node: FlowNode }
  | { type: 'pin'; nodeId: string; pinId: string; pin: FlowPin; isOutput: boolean }
  | { type: 'canvas' }

export interface ContextMenuEvent {
  screenX: number
  screenY: number
  worldX: number
  worldY: number
  target: ContextMenuTarget
}

export interface CanvasInteractionOptions {
  readOnly?: boolean
  snapToGrid?: number
  onSelectionChange?: (ids: Set<string>) => void
  onContextMenu?: (event: ContextMenuEvent) => void
  snapToAlignment?: boolean
  alignThreshold?: number
  onGroup?: (nodeIds: string[]) => void
  onSearchPalette?: () => void
}

export interface WaypointDragState {
  connectionId: string
  waypointId: string
}

export interface CanvasInteractionAPI {
  viewport: ViewportAPI
  selection: SelectionAPI
  nodeDrag: NodeDragAPI
  connection: ConnectionAPI
  needsRedraw: React.MutableRefObject<boolean>
  selectedRef: React.MutableRefObject<Set<string>>
  draftRef: React.MutableRefObject<DraftConnection | null>
  rubberBandRef: React.MutableRefObject<Rect | null>
  hoveredNodeRef: React.MutableRefObject<string | null>
  hoveredPinRef: React.MutableRefObject<HoverPin | null>
  alignmentGuidesRef: React.MutableRefObject<AlignmentGuide[]>
  selectedWaypointRef: React.MutableRefObject<string | null>
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
    snapToAlignment: options?.snapToAlignment,
    alignThreshold: options?.alignThreshold,
  })
  const connection = useConnection(store)
  const hotkeys = useHotkeys(store, {
    selected: selection.selected,
    clearSelection: selection.clear,
    selectAll: selection.selectAll,
    readOnly: options?.readOnly,
    onGroup: options?.onGroup,
    onSearchPalette: options?.onSearchPalette,
  })

  // Refs to track current state (avoid stale closures in event handlers)
  const draggingRef = useRef(nodeDrag.dragging)
  draggingRef.current = nodeDrag.dragging

  const draftRef = useRef(connection.draft)
  draftRef.current = connection.draft

  const selectedRef = useRef(selection.selected)
  selectedRef.current = selection.selected

  const rubberBandRef = useRef(selection.rubberBand)
  rubberBandRef.current = selection.rubberBand

  // Ref for nodeDrag API (startDrag has unstable deps on selected)
  const nodeDragRef = useRef(nodeDrag)
  nodeDragRef.current = nodeDrag

  // Ref for readOnly option
  const readOnlyRef = useRef(options?.readOnly)
  readOnlyRef.current = options?.readOnly

  // Ref for context menu callback
  const contextMenuRef = useRef(options?.onContextMenu)
  contextMenuRef.current = options?.onContextMenu

  // Hover tracking
  const hoveredNodeRef = useRef<string | null>(null)
  const hoveredPinRef = useRef<HoverPin | null>(null)

  // Waypoint drag state
  const draggingWaypointRef = useRef<WaypointDragState | null>(null)
  const selectedWaypointRef = useRef<string | null>(null)

  // onGroup ref
  const onGroupRef = useRef(options?.onGroup)
  onGroupRef.current = options?.onGroup

  // Rubber-band drag state (not in a hook - local refs)
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
      hoveredNodeRef.current = null
      hoveredPinRef.current = null

      if (readOnlyRef.current) return

      // Right-click -> pan
      if (e.button === 2) {
        e.preventDefault()
        isPanning.current = true
        panStart.current = { x: e.clientX, y: e.clientY }
        canvas.style.cursor = 'grabbing'
        markDirty()
        return
      }

      if (e.button !== 0) return

      const { world } = getWorldPos(e)
      const nodes = store.getNodes()
      const connections = store.getConnections()

      // Check waypoints first
      const wpHit = hitTestWaypoint(world, connections)
      if (wpHit) {
        draggingWaypointRef.current = { connectionId: wpHit.connectionId, waypointId: wpHit.waypointId }
        selectedWaypointRef.current = wpHit.waypointId
        markDirty()
        return
      }

      // Double-click on connection segment -> insert waypoint
      if (e.detail >= 2) {
        for (const conn of connections) {
          const fn = nodes.find(n => n.id === conn.fromNodeId)
          const tn = nodes.find(n => n.id === conn.toNodeId)
          if (!fn || !tn) continue
          const fpn = fn.outputs.find(p => p.id === conn.fromPinId)
          const tpn = tn.inputs.find(p => p.id === conn.toPinId)
          if (!fpn || !tpn) continue
          const fp = { x: fn.position.x + (fn.width ?? NODE_W), y: fn.position.y + PIN_Y0 + fn.outputs.indexOf(fpn) * SLOT_H + SLOT_H * 0.5 }
          const tp = { x: tn.position.x, y: tn.position.y + PIN_Y0 + tn.inputs.indexOf(tpn) * SLOT_H + SLOT_H * 0.5 }
          if (hitTestConnectionSegment(world, fp, tp, conn.waypoints, 10)) {
            const newWp: FlowWaypoint = { id: `wp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, x: world.x, y: world.y }
            const existing = conn.waypoints ?? []
            store.updateConnectionWaypoints(conn.id, [...existing, newWp])
            selectedWaypointRef.current = newWp.id
            markDirty()
            return
          }
        }
      }

      // Clear waypoint selection
      selectedWaypointRef.current = null

      // Check pins
      const pinHit = hitTestPin(world, nodes)
      if (pinHit) {
        connection.startConnection(pinHit)
        markDirty()
        return
      }

      // Check groups (before regular nodes)
      const groupHit = hitTestGroup(world, nodes)
      if (groupHit && groupHit.isHeader) {
        const group = store.getNode(groupHit.nodeId)
        if (group) {
          const childIds = (group.data.childIds as string[]) ?? []
          selection.selectAll([groupHit.nodeId, ...childIds])
          nodeDragRef.current.startDrag(groupHit.nodeId, world)
          canvas.style.cursor = 'grabbing'
          markDirty()
          return
        }
      }

      // Check nodes
      const nodeHit = hitTestNode(world, nodes)
      if (nodeHit) {
        if (e.shiftKey) {
          selection.toggle(nodeHit.id)
        } else if (!selectedRef.current.has(nodeHit.id)) {
          selection.select(nodeHit.id)
        }
        nodeDragRef.current.startDrag(nodeHit.id, world)
        canvas.style.cursor = 'grabbing'
        markDirty()
        return
      }

      // Empty canvas click - start rubber-band or clear selection
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

      // Waypoint dragging
      if (draggingWaypointRef.current) {
        const { connectionId, waypointId } = draggingWaypointRef.current
        const conn = store.getConnection(connectionId)
        if (conn?.waypoints) {
          const updated = conn.waypoints.map(wp =>
            wp.id === waypointId ? { ...wp, x: world.x, y: world.y } : wp,
          )
          store.updateConnectionWaypoints(connectionId, updated)
        }
        markDirty()
        return
      }

      // Node dragging
      if (draggingRef.current) {
        nodeDragRef.current.moveDrag(world)
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

      // Hover tracking + cursor
      const nodes = store.getNodes()
      const pin = hitTestPin(world, nodes)
      if (pin) {
        canvas.style.cursor = readOnlyRef.current ? 'default' : 'crosshair'
        const prev = hoveredPinRef.current
        if (!prev || prev.nodeId !== pin.nodeId || prev.pinId !== pin.pinId) {
          hoveredPinRef.current = { nodeId: pin.nodeId, pinId: pin.pinId, isOutput: pin.isOutput }
          hoveredNodeRef.current = pin.nodeId
          markDirty()
        }
        return
      }
      const node = hitTestNode(world, nodes)
      const nodeId = node?.id ?? null
      if (hoveredNodeRef.current !== nodeId || hoveredPinRef.current) {
        hoveredNodeRef.current = nodeId
        hoveredPinRef.current = null
        markDirty()
      }
      canvas.style.cursor = readOnlyRef.current ? 'default' : (node ? 'grab' : 'default')
    }

    const onMouseUp = (e: MouseEvent) => {
      // End pan
      if (isPanning.current) {
        isPanning.current = false
        canvas.style.cursor = 'default'
        markDirty()
        return
      }

      // End waypoint drag
      if (draggingWaypointRef.current) {
        draggingWaypointRef.current = null
        markDirty()
        return
      }

      // End node drag
      if (draggingRef.current) {
        nodeDragRef.current.endDrag()
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

      if (!contextMenuRef.current) return

      const { world } = getWorldPos(e)
      const nodes = store.getNodes()

      const pinHit = hitTestPin(world, nodes)
      let target: ContextMenuTarget

      if (pinHit) {
        const node = nodes.find(n => n.id === pinHit.nodeId)!
        const pin = pinHit.isOutput
          ? node.outputs.find(p => p.id === pinHit.pinId)!
          : node.inputs.find(p => p.id === pinHit.pinId)!
        target = { type: 'pin', nodeId: node.id, pinId: pin.id, pin, isOutput: pinHit.isOutput }
      } else {
        const nodeHit = hitTestNode(world, nodes)
        if (nodeHit) {
          target = { type: 'node', nodeId: nodeHit.id, node: nodeHit }
        } else {
          target = { type: 'canvas' }
        }
      }

      contextMenuRef.current({
        screenX: e.clientX,
        screenY: e.clientY,
        worldX: world.x,
        worldY: world.y,
        target,
      })
    }

    const onMouseLeave = () => {
      if (hoveredNodeRef.current || hoveredPinRef.current) {
        hoveredNodeRef.current = null
        hoveredPinRef.current = null
        markDirty()
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // Delete selected waypoint
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWaypointRef.current) {
        const wpId = selectedWaypointRef.current
        for (const conn of store.getConnections()) {
          if (!conn.waypoints) continue
          const idx = conn.waypoints.findIndex(wp => wp.id === wpId)
          if (idx >= 0) {
            const updated = conn.waypoints.filter(wp => wp.id !== wpId)
            store.updateConnectionWaypoints(conn.id, updated)
            break
          }
        }
        selectedWaypointRef.current = null
        markDirty()
        e.preventDefault()
        return
      }

      hotkeys.handleKeyDown(e)
      markDirty()
    }

    /* -- Touch support -- */

    // Track pinch state for two-finger zoom
    const pinchState = { active: false, initialDist: 0, initialZoom: 1 }
    const lastTouchPos = { value: null as { x: number; y: number } | null }

    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

    const onTouchStart = (e: TouchEvent) => {
      hoveredNodeRef.current = null
      hoveredPinRef.current = null

      if (readOnlyRef.current && e.touches.length === 1) return

      // Two-finger pinch-zoom
      if (e.touches.length === 2) {
        e.preventDefault()
        pinchState.active = true
        pinchState.initialDist = getTouchDist(e.touches[0], e.touches[1])
        pinchState.initialZoom = viewport.ref.current.zoom
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

      // Check waypoints
      const connections = store.getConnections()
      const wpHit = hitTestWaypoint(world, connections)
      if (wpHit) {
        draggingWaypointRef.current = { connectionId: wpHit.connectionId, waypointId: wpHit.waypointId }
        selectedWaypointRef.current = wpHit.waypointId
        markDirty()
        return
      }

      // Check pins
      const pinHit = hitTestPin(world, nodes)
      if (pinHit) {
        connection.startConnection(pinHit)
        markDirty()
        return
      }

      // Check group headers
      const groupHit = hitTestGroup(world, nodes)
      if (groupHit && groupHit.isHeader) {
        const group = nodes.find(n => n.id === groupHit.nodeId)
        if (group) {
          const childIds = (group.data?.childIds as string[]) ?? []
          const allIds = [groupHit.nodeId, ...childIds]
          selection.selectAll(allIds)
          nodeDragRef.current.startDrag(groupHit.nodeId, world)
          markDirty()
          return
        }
      }

      // Check nodes
      const nodeHit = hitTestNode(world, nodes)
      if (nodeHit) {
        if (!selectedRef.current.has(nodeHit.id)) {
          selection.select(nodeHit.id)
        }
        nodeDragRef.current.startDrag(nodeHit.id, world)
        markDirty()
        return
      }

      // Empty area - clear selection
      selectedWaypointRef.current = null
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

      // Waypoint dragging
      if (draggingWaypointRef.current) {
        const { connectionId, waypointId } = draggingWaypointRef.current
        const conn = store.getConnection(connectionId)
        if (conn?.waypoints) {
          const updated = conn.waypoints.map(wp =>
            wp.id === waypointId ? { ...wp, x: world.x, y: world.y } : wp,
          )
          store.updateConnectionWaypoints(connectionId, updated)
        }
        markDirty()
        return
      }

      // Node dragging
      if (draggingRef.current) {
        nodeDragRef.current.moveDrag(world)
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

      // End waypoint drag
      if (draggingWaypointRef.current) {
        draggingWaypointRef.current = null
        markDirty()
        return
      }

      // End node drag
      if (draggingRef.current) {
        nodeDragRef.current.endDrag()
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

    /* -- Attach all listeners -- */

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onContextMenu)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.setAttribute('tabindex', '0')
    canvas.addEventListener('keydown', onKeyDown)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [store, viewport, connection, selection, hotkeys, markDirty])

  return {
    viewport, selection, nodeDrag, connection, needsRedraw,
    selectedRef, draftRef, rubberBandRef, hoveredNodeRef, hoveredPinRef,
    alignmentGuidesRef: nodeDrag.alignmentGuides,
    selectedWaypointRef,
    attach,
  }
}
