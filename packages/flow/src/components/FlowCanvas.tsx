import React, { useRef, useEffect } from 'react'
import type { FlowGraph, FlowNode, FlowPin } from '../types'
import type { NodeDefinitionWithFactory } from '../define'
import { GraphModel } from '../model/GraphModel'
import { ConnectionValidator } from '../model/ConnectionValidator'
import { History } from '../model/History'

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

export interface FlowTheme {
  canvas?: {
    background?: string
    grid?: string
    gridMajor?: string
  }
  node?: {
    background?: string
    border?: string
    header?: string
    text?: string
    subtext?: string
    shadow?: string
  }
  pin?: {
    exec?: string
    string?: string
    number?: string
    boolean?: string
    object?: string
    array?: string
    [key: string]: string | undefined
  }
  connection?: {
    width?: number
    glowSize?: number
    glowOpacity?: number
  }
}

export interface FlowCanvasProps {
  graph: FlowGraph
  nodeDefinitions?: NodeDefinitionWithFactory[]
  theme?: FlowTheme
  onGraphChange?: (graph: FlowGraph) => void
  onConnect?: (fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string) => void
  onNodeMove?: (nodeId: string, x: number, y: number) => void
  readOnly?: boolean
  width?: number | string
  height?: number | string
}

/* ═══════════════════════════════════════════════════════════
   Layout constants
   ═══════════════════════════════════════════════════════════ */

const NODE_W = 232
const HEADER_H = 38
const PIN_ROW = 28
const PIN_R = 5.5
const EXEC_S = 6.5
const PIN_Y0 = 52
const PAD_BOTTOM = 18
const CORNER = 10
const ACCENT_W = 4
const GRID_STEP = 24
const GRID_MAJOR = 5

/* ═══════════════════════════════════════════════════════════
   Default theme — "Midnight Forge"
   ═══════════════════════════════════════════════════════════ */

const PIN_COLORS: Record<string, string> = {
  exec:    '#bfc8d4',
  string:  '#f472b6',
  number:  '#34d399',
  boolean: '#fb923c',
  object:  '#60a5fa',
  array:   '#c084fc',
}

const DEFAULT_THEME: FlowTheme = {
  canvas: {
    background: '#0b0b14',
    grid: 'rgba(255,255,255,0.03)',
    gridMajor: 'rgba(255,255,255,0.07)',
  },
  node: {
    background: '#13132b',
    border: 'rgba(255,255,255,0.06)',
    header: '#1a1a3a',
    text: '#e8ecf4',
    subtext: '#6b7a94',
    shadow: 'rgba(0,0,0,0.55)',
  },
  pin: PIN_COLORS,
  connection: {
    width: 2.5,
    glowSize: 8,
    glowOpacity: 0.18,
  },
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function merge<T extends Record<string, unknown>>(base: T, over?: Partial<T>): T {
  return { ...base, ...over } as T
}

function buildTheme(custom?: FlowTheme): FlowTheme {
  return {
    canvas: merge(DEFAULT_THEME.canvas!, custom?.canvas),
    node: merge(DEFAULT_THEME.node!, custom?.node),
    pin: { ...PIN_COLORS, ...custom?.pin },
    connection: merge(DEFAULT_THEME.connection!, custom?.connection),
  }
}

function pinColor(type: string, theme: FlowTheme): string {
  return theme.pin?.[type] ?? PIN_COLORS[type] ?? '#6b7a94'
}

function nodeHeight(node: FlowNode): number {
  const rows = Math.max(node.inputs.length, node.outputs.length)
  if (rows === 0) return HEADER_H + 26
  return PIN_Y0 + (rows - 1) * PIN_ROW + PIN_R + PAD_BOTTOM
}

function pinPos(
  node: FlowNode,
  pinId: string,
  isOutput: boolean,
): { x: number; y: number } | null {
  const list = isOutput ? node.outputs : node.inputs
  const idx = list.findIndex(p => p.id === pinId)
  if (idx < 0) return null
  return {
    x: node.position.x + (isOutput ? NODE_W : 0),
    y: node.position.y + PIN_Y0 + idx * PIN_ROW,
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* ═══════════════════════════════════════════════════════════
   Drawing — Grid
   ═══════════════════════════════════════════════════════════ */

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dotColor: string,
  majorColor: string,
) {
  for (let gx = GRID_STEP; gx < w; gx += GRID_STEP) {
    for (let gy = GRID_STEP; gy < h; gy += GRID_STEP) {
      const major =
        gx % (GRID_STEP * GRID_MAJOR) === 0 &&
        gy % (GRID_STEP * GRID_MAJOR) === 0
      ctx.fillStyle = major ? majorColor : dotColor
      ctx.beginPath()
      ctx.arc(gx, gy, major ? 1.4 : 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   Drawing — Pins
   ═══════════════════════════════════════════════════════════ */

function drawExecPin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
) {
  const s = EXEC_S
  ctx.beginPath()
  ctx.moveTo(cx, cy - s)
  ctx.lineTo(cx + s, cy)
  ctx.lineTo(cx, cy + s)
  ctx.lineTo(cx - s, cy)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = hexToRgba(color, 0.4)
  ctx.lineWidth = 1
  ctx.stroke()
}

function drawDataPin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
) {
  // Outer glow ring
  ctx.beginPath()
  ctx.arc(cx, cy, PIN_R + 2, 0, Math.PI * 2)
  ctx.fillStyle = hexToRgba(color, 0.12)
  ctx.fill()

  // Main circle
  ctx.beginPath()
  ctx.arc(cx, cy, PIN_R, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  // Inner highlight
  ctx.beginPath()
  ctx.arc(cx - 1.2, cy - 1.2, PIN_R * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fill()
}

/* ═══════════════════════════════════════════════════════════
   Drawing — Nodes
   ═══════════════════════════════════════════════════════════ */

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: FlowNode,
  theme: FlowTheme,
) {
  const x = node.position.x
  const y = node.position.y
  const w = node.width ?? NODE_W
  const h = nodeHeight(node)
  const accent = node.color ?? '#6c63ff'

  // ── Shadow ──
  ctx.save()
  ctx.shadowColor = theme.node!.shadow!
  ctx.shadowBlur = 32
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 10
  ctx.fillStyle = theme.node!.background!
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.fill()
  ctx.restore()

  // ── Body fill (re-draw without shadow for crisp edge) ──
  ctx.fillStyle = theme.node!.background!
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.fill()

  // ── Border ──
  ctx.strokeStyle = theme.node!.border!
  ctx.lineWidth = 1
  ctx.stroke()

  // ── Header ──
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, HEADER_H, [CORNER, CORNER, 0, 0])
  ctx.clip()

  // Header background
  ctx.fillStyle = theme.node!.header!
  ctx.fillRect(x, y, w, HEADER_H)

  // Accent strip (left)
  ctx.fillStyle = accent
  ctx.fillRect(x, y, ACCENT_W, HEADER_H)

  // Subtle accent glow on header
  const headerGlow = ctx.createLinearGradient(x, y, x + 80, y)
  headerGlow.addColorStop(0, hexToRgba(accent, 0.08))
  headerGlow.addColorStop(1, 'transparent')
  ctx.fillStyle = headerGlow
  ctx.fillRect(x, y, w, HEADER_H)

  ctx.restore()

  // ── Header separator ──
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fillRect(x, y + HEADER_H - 1, w, 1)

  // ── Title ──
  ctx.fillStyle = theme.node!.text!
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(node.label, x + ACCENT_W + 14, y + HEADER_H / 2 + 0.5)

  // ── Input pins ──
  node.inputs.forEach((pin, i) => {
    const py = y + PIN_Y0 + i * PIN_ROW
    const px = x
    const color = pinColor(pin.type, theme)

    if (pin.type === 'exec') {
      drawExecPin(ctx, px, py, color)
    } else {
      drawDataPin(ctx, px, py, color)
    }

    if (pin.label) {
      ctx.fillStyle = theme.node!.subtext!
      ctx.font = '11px "Cascadia Code", Consolas, "SF Mono", monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(pin.label, px + 16, py)
    }
  })

  // ── Output pins ──
  node.outputs.forEach((pin, i) => {
    const py = y + PIN_Y0 + i * PIN_ROW
    const px = x + w
    const color = pinColor(pin.type, theme)

    if (pin.type === 'exec') {
      drawExecPin(ctx, px, py, color)
    } else {
      drawDataPin(ctx, px, py, color)
    }

    if (pin.label) {
      ctx.fillStyle = theme.node!.subtext!
      ctx.font = '11px "Cascadia Code", Consolas, "SF Mono", monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(pin.label, px - 16, py)
    }
  })
}

/* ═══════════════════════════════════════════════════════════
   Drawing — Connections (bezier with glow)
   ═══════════════════════════════════════════════════════════ */

function drawConnection(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  lineWidth: number,
  glowSize: number,
  glowOpacity: number,
) {
  const dx = Math.abs(to.x - from.x)
  const cp = Math.max(dx * 0.45, 70)

  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.bezierCurveTo(
    from.x + cp, from.y,
    to.x - cp, to.y,
    to.x, to.y,
  )

  // Glow pass
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = glowSize
  ctx.globalAlpha = glowOpacity
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth + 4
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()

  // Main line
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.stroke()

  // Endpoint dots
  const dotR = lineWidth * 0.8
  for (const pt of [from, to]) {
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, dotR, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  model: GraphModel,
  theme: FlowTheme,
) {
  const nodes = model.getNodes()
  const connections = model.getConnections()

  for (const conn of connections) {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId)
    const toNode = nodes.find(n => n.id === conn.toNodeId)
    if (!fromNode || !toNode) continue

    const fromPos = pinPos(fromNode, conn.fromPinId, true)
    const toPos = pinPos(toNode, conn.toPinId, false)
    if (!fromPos || !toPos) continue

    const fromPin = fromNode.outputs.find(p => p.id === conn.fromPinId)
    const color = fromPin
      ? pinColor(fromPin.type, theme)
      : '#6c63ff'

    drawConnection(
      ctx,
      fromPos,
      toPos,
      color,
      theme.connection!.width as number,
      theme.connection!.glowSize as number,
      theme.connection!.glowOpacity as number,
    )
  }
}

/* ═══════════════════════════════════════════════════════════
   Drawing — Vignette
   ═══════════════════════════════════════════════════════════ */

function drawVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.65)
  grd.addColorStop(0, 'rgba(255,255,255,0.008)')
  grd.addColorStop(0.6, 'transparent')
  grd.addColorStop(1, 'rgba(0,0,0,0.15)')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, w, h)
}

/* ═══════════════════════════════════════════════════════════
   Main render
   ═══════════════════════════════════════════════════════════ */

function renderCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  model: GraphModel,
  theme: FlowTheme,
) {
  // 1 — Background
  ctx.fillStyle = theme.canvas!.background!
  ctx.fillRect(0, 0, w, h)

  // 2 — Grid dots
  drawGrid(ctx, w, h, theme.canvas!.grid!, theme.canvas!.gridMajor!)

  // 3 — Vignette
  drawVignette(ctx, w, h)

  // 4 — Connections (behind nodes)
  drawConnections(ctx, model, theme)

  // 5 — Nodes
  for (const node of model.getNodes()) {
    drawNode(ctx, node, theme)
  }
}

/* ═══════════════════════════════════════════════════════════
   React Component
   ═══════════════════════════════════════════════════════════ */

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  graph,
  theme: themeProp,
  onGraphChange,
  readOnly = false,
  width = '100%',
  height = '600px',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<GraphModel>(GraphModel.fromJSON(graph))

  // Sync model when graph prop changes
  useEffect(() => {
    modelRef.current = GraphModel.fromJSON(graph)
  }, [graph])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const theme = buildTheme(themeProp)

    // HiDPI support
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    renderCanvas(ctx, rect.width, rect.height, modelRef.current, theme)
  }, [graph, themeProp])

  // Re-render on resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(() => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const theme = buildTheme(themeProp)
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)

      renderCanvas(ctx, rect.width, rect.height, modelRef.current, theme)
    })

    observer.observe(canvas)
    return () => observer.disconnect()
  }, [graph, themeProp])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        display: 'block',
        borderRadius: '8px',
      }}
    />
  )
}
