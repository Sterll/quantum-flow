import React, { useRef, useEffect, useMemo } from 'react'
import type { FlowNode, FlowPin } from '../types'
import type { GraphStore } from '../model/GraphStore'
import { useCanvasInteraction } from '../hooks/useCanvasInteraction'
import { nodeHeight } from '../hooks/hitTest'
import type { DraftConnection } from '../hooks/useConnection'
import type { Rect } from '../hooks/useSelection'

/* ══════════════════════════════════════════════════════════════
   FlowCanvas — Interactive Canvas 2D node editor
   Claude Terminal WorkflowGraphEngine rendering style
   ══════════════════════════════════════════════════════════════ */

export interface FlowTheme {
  canvas?: { background?: string; gridColor?: string }
  node?: { titleBar?: string; body?: string; border?: string; text?: string; subtext?: string }
  pin?: { exec?: string; string?: string; number?: string; boolean?: string; object?: string; array?: string; [k: string]: string | undefined }
  connection?: { width?: number; opacity?: number }
  selection?: { color?: string }
}

export interface FlowCanvasProps {
  store: GraphStore
  theme?: FlowTheme
  readOnly?: boolean
  snapToGrid?: number
  onSelectionChange?: (ids: Set<string>) => void
  width?: number | string
  height?: number | string
}

/* ── constants (from Claude Terminal WorkflowGraphEngine) ── */

const FONT = '-apple-system, "Segoe UI", system-ui, sans-serif'
const TITLE_H = 30
const SLOT_H = 22
const PIN_R = 4.5
const DIAMOND_R = 5
const GRID_SIZE = 20
const NODE_W = 220
const CORNER = 8
const PIN_Y0 = TITLE_H + 10

/* ── pin colors (from Claude Terminal) ── */

const PIN_COLORS: Record<string, string> = {
  exec:    '#ffffff',
  string:  '#f472b6',
  number:  '#34d399',
  boolean: '#fb923c',
  object:  '#60a5fa',
  array:   '#c084fc',
}

/* ── defaults (from Claude Terminal) ── */

const DEFAULTS = {
  bg: '#0a0a0a',
  gridColor: 'rgba(255,255,255,0.03)',
  titleBar: '#141416',
  body: '#101012',
  border: 'rgba(255,255,255,0.04)',
  text: '#bbb',
  subtext: '#888',
  wireW: 2,
  wireOpacity: 0.7,
  selectionColor: '#60a5fa',
}

/* ── helpers ── */

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function pinColor(type: string, theme: FlowTheme): string {
  return theme.pin?.[type] ?? PIN_COLORS[type] ?? '#6b7280'
}

interface Vec2 { x: number; y: number }

function pinPos(node: FlowNode, pinId: string, isOutput: boolean): Vec2 | null {
  const list = isOutput ? node.outputs : node.inputs
  const idx = list.findIndex(p => p.id === pinId)
  if (idx < 0) return null
  return {
    x: node.position.x + (isOutput ? (node.width ?? NODE_W) : 0),
    y: node.position.y + PIN_Y0 + idx * SLOT_H + SLOT_H * 0.5,
  }
}

function buildConnectedPins(nodes: FlowNode[], connections: Array<{ fromNodeId: string; fromPinId: string; toNodeId: string; toPinId: string }>): Set<string> {
  const set = new Set<string>()
  for (const c of connections) {
    set.add(`${c.fromNodeId}:${c.fromPinId}:out`)
    set.add(`${c.toNodeId}:${c.toPinId}:in`)
  }
  return set
}

function buildTheme(custom?: FlowTheme): FlowTheme {
  return {
    canvas: {
      background: custom?.canvas?.background ?? DEFAULTS.bg,
      gridColor: custom?.canvas?.gridColor ?? DEFAULTS.gridColor,
    },
    node: {
      titleBar: custom?.node?.titleBar ?? DEFAULTS.titleBar,
      body: custom?.node?.body ?? DEFAULTS.body,
      border: custom?.node?.border ?? DEFAULTS.border,
      text: custom?.node?.text ?? DEFAULTS.text,
      subtext: custom?.node?.subtext ?? DEFAULTS.subtext,
    },
    pin: { ...PIN_COLORS, ...custom?.pin },
    connection: {
      width: custom?.connection?.width ?? DEFAULTS.wireW,
      opacity: custom?.connection?.opacity ?? DEFAULTS.wireOpacity,
    },
    selection: {
      color: custom?.selection?.color ?? DEFAULTS.selectionColor,
    },
  }
}

/* ── grid ── */

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, theme: FlowTheme, offsetX: number, offsetY: number, zoom: number) {
  ctx.fillStyle = theme.canvas!.background!
  ctx.fillRect(0, 0, w, h)

  const gridSize = GRID_SIZE * zoom
  if (gridSize < 4) return // too zoomed out to show grid

  ctx.strokeStyle = theme.canvas!.gridColor!
  ctx.lineWidth = 0.5
  ctx.beginPath()

  const startX = offsetX % gridSize
  const startY = offsetY % gridSize

  for (let x = startX; x < w; x += gridSize) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = startY; y < h; y += gridSize) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()
}

/* ── pins ── */

function drawPins(
  ctx: CanvasRenderingContext2D,
  node: FlowNode,
  theme: FlowTheme,
  connectedPins: Set<string>,
) {
  const x = node.position.x
  const y = node.position.y
  const w = node.width ?? NODE_W

  const drawPinList = (pins: FlowPin[], isOutput: boolean) => {
    pins.forEach((pin, i) => {
      const py = y + PIN_Y0 + i * SLOT_H + SLOT_H * 0.5
      const px = isOutput ? x + w : x
      const color = pinColor(pin.type, theme)
      const connected = connectedPins.has(`${node.id}:${pin.id}:${isOutput ? 'out' : 'in'}`)

      if (pin.type === 'exec') {
        const r = DIAMOND_R
        ctx.beginPath()
        ctx.moveTo(px, py - r)
        ctx.lineTo(px + r, py)
        ctx.lineTo(px, py + r)
        ctx.lineTo(px - r, py)
        ctx.closePath()
        if (connected) {
          ctx.fillStyle = '#ccc'
          ctx.fill()
        } else {
          ctx.strokeStyle = '#888'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      } else {
        ctx.beginPath()
        ctx.arc(px, py, PIN_R, 0, Math.PI * 2)
        if (connected) {
          ctx.save()
          ctx.shadowColor = color
          ctx.shadowBlur = 6
          ctx.fillStyle = color
          ctx.fill()
          ctx.restore()
        } else {
          ctx.strokeStyle = hexToRgba(color, 0.6)
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      if (pin.label) {
        ctx.fillStyle = hexToRgba(color, 0.7)
        ctx.font = `500 11px ${FONT}`
        ctx.textAlign = isOutput ? 'right' : 'left'
        ctx.textBaseline = 'middle'
        const labelX = isOutput ? px - 12 : px + 12
        ctx.fillText(pin.label, labelX, py)

        if (pin.type !== 'exec') {
          ctx.fillStyle = hexToRgba(color, 0.3)
          ctx.font = `400 9px ${FONT}`
          ctx.fillText(pin.type, labelX, py + 12)
        }
      }
    })
  }

  drawPinList(node.inputs, false)
  drawPinList(node.outputs, true)
}

/* ── node ── */

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: FlowNode,
  theme: FlowTheme,
  connectedPins: Set<string>,
  isSelected: boolean,
) {
  const x = node.position.x
  const y = node.position.y
  const w = node.width ?? NODE_W
  const h = nodeHeight(node)
  const accent = node.color ?? '#6c63ff'

  // Shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 4
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.fillStyle = theme.node!.body!
  ctx.fill()
  ctx.restore()

  // Title bar
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()
  ctx.fillStyle = theme.node!.titleBar!
  ctx.fillRect(x, y, w, TITLE_H)
  ctx.fillStyle = hexToRgba(accent, 0.18)
  ctx.fillRect(x, y, w, TITLE_H)
  ctx.fillStyle = accent
  ctx.fillRect(x, y, w, 2)
  ctx.restore()

  // Body
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()
  ctx.fillStyle = theme.node!.body!
  ctx.fillRect(x, y + TITLE_H, w, h - TITLE_H)
  const gradient = ctx.createLinearGradient(x, y + TITLE_H, x, y + TITLE_H + 18)
  gradient.addColorStop(0, hexToRgba(accent, 0.06))
  gradient.addColorStop(1, 'transparent')
  ctx.fillStyle = gradient
  ctx.fillRect(x, y + TITLE_H, w, 18)
  ctx.restore()

  // Border
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.strokeStyle = isSelected ? theme.selection!.color! : theme.node!.border!
  ctx.lineWidth = isSelected ? 2 : 0.5
  ctx.stroke()

  // Selection glow
  if (isSelected) {
    ctx.save()
    ctx.shadowColor = theme.selection!.color!
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, CORNER)
    ctx.strokeStyle = theme.selection!.color!
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }

  // Title dot
  ctx.save()
  ctx.shadowColor = accent
  ctx.shadowBlur = 4
  ctx.beginPath()
  ctx.arc(x + 12, y + TITLE_H * 0.5, 4, 0, Math.PI * 2)
  ctx.fillStyle = accent
  ctx.fill()
  ctx.restore()

  // Title text
  ctx.fillStyle = theme.node!.text!
  ctx.font = `600 12px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(node.label, x + 22, y + TITLE_H * 0.5)

  drawPins(ctx, node, theme, connectedPins)
}

/* ── connections ── */

function drawConnections(ctx: CanvasRenderingContext2D, store: GraphStore, theme: FlowTheme) {
  const nodes = store.getNodes()

  ctx.save()
  ctx.globalAlpha = theme.connection!.opacity as number
  ctx.lineWidth = theme.connection!.width as number
  ctx.lineCap = 'round'

  for (const conn of store.getConnections()) {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId)
    const toNode = nodes.find(n => n.id === conn.toNodeId)
    if (!fromNode || !toNode) continue

    const fromP = pinPos(fromNode, conn.fromPinId, true)
    const toP = pinPos(toNode, conn.toPinId, false)
    if (!fromP || !toP) continue

    const fromPin = fromNode.outputs.find(p => p.id === conn.fromPinId)
    const color = pinColor(fromPin?.type ?? 'exec', theme)
    const dx = Math.abs(toP.x - fromP.x)
    const offset = Math.max(dx * 0.5, 60)

    ctx.beginPath()
    ctx.moveTo(fromP.x, fromP.y)
    ctx.bezierCurveTo(fromP.x + offset, fromP.y, toP.x - offset, toP.y, toP.x, toP.y)
    ctx.strokeStyle = color
    ctx.stroke()
  }

  ctx.restore()
}

/* ── draft connection ── */

function drawDraftConnection(ctx: CanvasRenderingContext2D, draft: DraftConnection, theme: FlowTheme) {
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.lineWidth = (theme.connection!.width as number) ?? 2
  ctx.lineCap = 'round'
  ctx.setLineDash([6, 4])

  const from = draft.fromPos
  const to = draft.toPos
  const dx = Math.abs(to.x - from.x)
  const offset = Math.max(dx * 0.5, 60)

  ctx.beginPath()
  if (draft.isFromOutput) {
    ctx.moveTo(from.x, from.y)
    ctx.bezierCurveTo(from.x + offset, from.y, to.x - offset, to.y, to.x, to.y)
  } else {
    ctx.moveTo(from.x, from.y)
    ctx.bezierCurveTo(from.x - offset, from.y, to.x + offset, to.y, to.x, to.y)
  }
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.restore()
}

/* ── rubber-band ── */

function drawRubberBand(ctx: CanvasRenderingContext2D, rect: Rect, theme: FlowTheme) {
  const color = theme.selection!.color!
  ctx.save()
  ctx.fillStyle = hexToRgba(color.startsWith('#') ? color : '#60a5fa', 0.08)
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.strokeStyle = hexToRgba(color.startsWith('#') ? color : '#60a5fa', 0.4)
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  ctx.restore()
}

/* ── component ── */

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  store,
  theme: customTheme,
  readOnly,
  snapToGrid,
  onSelectionChange,
  width = '100%',
  height = '600px',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useMemo(() => buildTheme(customTheme), [customTheme])

  const interaction = useCanvasInteraction(store, {
    readOnly,
    snapToGrid,
    onSelectionChange,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const detach = interaction.attach(canvas)
    const dpr = window.devicePixelRatio || 1

    let rafId: number

    const paint = () => {
      if (!interaction.needsRedraw.current) {
        rafId = requestAnimationFrame(paint)
        return
      }
      interaction.needsRedraw.current = false

      const rect = canvas.getBoundingClientRect()
      const cw = rect.width
      const ch = rect.height
      canvas.width = cw * dpr
      canvas.height = ch * dpr

      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Draw grid in screen-space (before viewport transform)
      const { offset, zoom } = interaction.viewport.ref.current
      drawGrid(ctx, cw, ch, theme, offset.x, offset.y, zoom)

      // Apply viewport transform for everything else
      ctx.save()
      ctx.translate(offset.x, offset.y)
      ctx.scale(zoom, zoom)

      // Draw connections
      drawConnections(ctx, store, theme)

      // Draw nodes
      const nodes = store.getNodes()
      const connections = store.getConnections()
      const connectedPins = buildConnectedPins(nodes, connections)
      for (const node of nodes) {
        drawNode(ctx, node, theme, connectedPins, interaction.selection.selected.has(node.id))
      }

      // Draw draft connection
      if (interaction.connection.draft) {
        drawDraftConnection(ctx, interaction.connection.draft, theme)
      }

      // Draw rubber-band
      if (interaction.selection.rubberBand) {
        drawRubberBand(ctx, interaction.selection.rubberBand, theme)
      }

      ctx.restore()

      rafId = requestAnimationFrame(paint)
    }

    // Initial draw
    interaction.needsRedraw.current = true
    rafId = requestAnimationFrame(paint)

    // Also redraw on resize
    const observer = new ResizeObserver(() => {
      interaction.needsRedraw.current = true
    })
    observer.observe(canvas)

    // Redraw when store changes
    const unsubImported = store.events.on('graph:imported', () => { interaction.needsRedraw.current = true })
    const unsubNodeAdded = store.events.on('node:added', () => { interaction.needsRedraw.current = true })
    const unsubNodeRemoved = store.events.on('node:removed', () => { interaction.needsRedraw.current = true })
    const unsubNodeMoved = store.events.on('node:moved', () => { interaction.needsRedraw.current = true })
    const unsubConnAdded = store.events.on('connection:added', () => { interaction.needsRedraw.current = true })
    const unsubConnRemoved = store.events.on('connection:removed', () => { interaction.needsRedraw.current = true })
    const unsubBatchEnd = store.events.on('batch:end', () => { interaction.needsRedraw.current = true })

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      detach()
      unsubImported()
      unsubNodeAdded()
      unsubNodeRemoved()
      unsubNodeMoved()
      unsubConnAdded()
      unsubConnRemoved()
      unsubBatchEnd()
    }
  }, [store, customTheme, readOnly, snapToGrid])

  return <canvas ref={canvasRef} style={{
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    display: 'block',
    outline: 'none',
  }} />
}
