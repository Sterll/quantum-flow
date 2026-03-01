import React, { useRef, useEffect } from 'react'
import type { FlowGraph, FlowNode } from '../types'
import type { NodeDefinitionWithFactory } from '../define'
import { GraphModel } from '../model/GraphModel'

/* ────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────── */

export interface FlowTheme {
  canvas?: {
    background?: string
    dotColor?: string
    dotSpacing?: number
  }
  node?: {
    background?: string
    border?: string
    headerTint?: number
    text?: string
    subtext?: string
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
    execColor?: string
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

/* ────────────────────────────────────────────────
   Layout
   ──────────────────────────────────────────────── */

const NODE_W = 240
const HEADER_H = 34
const PIN_ROW = 24
const PIN_R = 3.5
const PIN_Y0 = HEADER_H + 16
const PAD_BOTTOM = 14
const CORNER = 8
const DOT_SPACING = 20

/* ────────────────────────────────────────────────
   Default theme
   ──────────────────────────────────────────────── */

const PIN_COLORS: Record<string, string> = {
  exec:    '#9ca3af',
  string:  '#f472b6',
  number:  '#34d399',
  boolean: '#fb923c',
  object:  '#60a5fa',
  array:   '#c084fc',
}

const DEFAULT_THEME: Required<FlowTheme> = {
  canvas: {
    background: '#0c0c0c',
    dotColor: 'rgba(255,255,255,0.035)',
    dotSpacing: DOT_SPACING,
  },
  node: {
    background: '#151520',
    border: 'rgba(255,255,255,0.06)',
    headerTint: 0.10,
    text: '#e2e4ea',
    subtext: '#6b7280',
  },
  pin: PIN_COLORS,
  connection: {
    width: 1.8,
    execColor: '#4b5563',
  },
}

/* ────────────────────────────────────────────────
   Utilities
   ──────────────────────────────────────────────── */

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function pinColor(type: string, theme: FlowTheme): string {
  return theme.pin?.[type] ?? PIN_COLORS[type] ?? '#6b7280'
}

function nodeHeight(node: FlowNode): number {
  const rows = Math.max(node.inputs.length, node.outputs.length)
  if (rows === 0) return HEADER_H + 18
  return PIN_Y0 + (rows - 1) * PIN_ROW + PIN_R + PAD_BOTTOM
}

interface Vec2 { x: number; y: number }

function pinPos(node: FlowNode, pinId: string, isOutput: boolean): Vec2 | null {
  const list = isOutput ? node.outputs : node.inputs
  const idx = list.findIndex(p => p.id === pinId)
  if (idx < 0) return null
  return {
    x: node.position.x + (isOutput ? NODE_W : 0),
    y: node.position.y + PIN_Y0 + idx * PIN_ROW,
  }
}

function bezierCP(from: Vec2, to: Vec2): [Vec2, Vec2] {
  const off = Math.max(Math.abs(to.x - from.x) * 0.4, 60)
  return [
    { x: from.x + off, y: from.y },
    { x: to.x - off, y: to.y },
  ]
}

/* ────────────────────────────────────────────────
   Theme builder
   ──────────────────────────────────────────────── */

function merge<T extends Record<string, unknown>>(base: T, over?: Partial<T>): T {
  if (!over) return base
  const out = { ...base }
  for (const k of Object.keys(over)) {
    if ((over as Record<string, unknown>)[k] !== undefined) {
      (out as Record<string, unknown>)[k] = (over as Record<string, unknown>)[k]
    }
  }
  return out
}

function buildTheme(custom?: FlowTheme): FlowTheme {
  return {
    canvas: merge(DEFAULT_THEME.canvas, custom?.canvas),
    node: merge(DEFAULT_THEME.node, custom?.node),
    pin: { ...PIN_COLORS, ...custom?.pin },
    connection: merge(DEFAULT_THEME.connection, custom?.connection),
  }
}

/* ────────────────────────────────────────────────
   Background
   ──────────────────────────────────────────────── */

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, theme: FlowTheme) {
  ctx.fillStyle = theme.canvas!.background!
  ctx.fillRect(0, 0, w, h)

  const sp = theme.canvas!.dotSpacing ?? DOT_SPACING
  ctx.fillStyle = theme.canvas!.dotColor!
  for (let x = sp; x < w; x += sp) {
    for (let y = sp; y < h; y += sp) {
      ctx.beginPath()
      ctx.arc(x, y, 0.7, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/* ────────────────────────────────────────────────
   Pins — diamond (exec) / circle (data)
   ──────────────────────────────────────────────── */

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  const s = 4.5
  ctx.beginPath()
  ctx.moveTo(cx, cy - s)
  ctx.lineTo(cx + s, cy)
  ctx.lineTo(cx, cy + s)
  ctx.lineTo(cx - s, cy)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function drawCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.beginPath()
  ctx.arc(cx, cy, PIN_R, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
}

/* ────────────────────────────────────────────────
   Node
   ──────────────────────────────────────────────── */

function drawNode(ctx: CanvasRenderingContext2D, node: FlowNode, theme: FlowTheme) {
  const x = node.position.x
  const y = node.position.y
  const w = node.width ?? NODE_W
  const h = nodeHeight(node)
  const accent = node.color ?? '#6c63ff'

  // Shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 4
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.fillStyle = theme.node!.background!
  ctx.fill()
  ctx.restore()

  // Body
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.fillStyle = theme.node!.background!
  ctx.fill()

  // Header tint (clip to node shape)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()
  ctx.fillStyle = hexToRgba(accent, theme.node!.headerTint as number)
  ctx.fillRect(x, y, w, HEADER_H)
  // Accent bar
  ctx.fillStyle = accent
  ctx.fillRect(x, y, 3, HEADER_H)
  ctx.restore()

  // Border
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.strokeStyle = theme.node!.border!
  ctx.lineWidth = 1
  ctx.stroke()

  // Header separator
  ctx.strokeStyle = theme.node!.border!
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y + HEADER_H)
  ctx.lineTo(x + w, y + HEADER_H)
  ctx.stroke()

  // Accent dot
  ctx.beginPath()
  ctx.arc(x + 12, y + HEADER_H / 2, 2.5, 0, Math.PI * 2)
  ctx.fillStyle = accent
  ctx.fill()

  // Title
  ctx.fillStyle = theme.node!.text!
  ctx.font = '600 12px -apple-system, "Segoe UI", system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(node.label, x + 20, y + HEADER_H / 2)

  // Input pins
  node.inputs.forEach((pin, i) => {
    const py = y + PIN_Y0 + i * PIN_ROW
    const px = x
    const col = pinColor(pin.type, theme)

    if (pin.type === 'exec') {
      drawDiamond(ctx, px, py, col)
    } else {
      drawCircle(ctx, px, py, col)
    }

    if (pin.label) {
      ctx.fillStyle = theme.node!.subtext!
      ctx.font = '11px -apple-system, "Segoe UI", system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(pin.label, px + 10, py)
    }
  })

  // Output pins
  node.outputs.forEach((pin, i) => {
    const py = y + PIN_Y0 + i * PIN_ROW
    const px = x + w
    const col = pinColor(pin.type, theme)

    if (pin.type === 'exec') {
      drawDiamond(ctx, px, py, col)
    } else {
      drawCircle(ctx, px, py, col)
    }

    if (pin.label) {
      ctx.fillStyle = theme.node!.subtext!
      ctx.font = '11px -apple-system, "Segoe UI", system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(pin.label, px - 10, py)
    }
  })
}

/* ────────────────────────────────────────────────
   Connections
   ──────────────────────────────────────────────── */

function drawBezier(
  ctx: CanvasRenderingContext2D,
  from: Vec2,
  to: Vec2,
  color: string,
  lw: number,
) {
  const [cp1, cp2] = bezierCP(from, to)
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y)
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.stroke()
}

function drawConnections(ctx: CanvasRenderingContext2D, model: GraphModel, theme: FlowTheme) {
  const nodes = model.getNodes()
  const lw = theme.connection!.width as number

  for (const conn of model.getConnections()) {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId)
    const toNode = nodes.find(n => n.id === conn.toNodeId)
    if (!fromNode || !toNode) continue

    const fromP = pinPos(fromNode, conn.fromPinId, true)
    const toP = pinPos(toNode, conn.toPinId, false)
    if (!fromP || !toP) continue

    const fromPin = fromNode.outputs.find(p => p.id === conn.fromPinId)
    const isExec = fromPin?.type === 'exec'
    const color = isExec
      ? (theme.connection!.execColor ?? '#4b5563')
      : pinColor(fromPin?.type ?? 'string', theme)

    drawBezier(ctx, fromP, toP, color, lw)
  }
}

/* ────────────────────────────────────────────────
   Main render
   ──────────────────────────────────────────────── */

function renderCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  model: GraphModel,
  theme: FlowTheme,
) {
  drawBackground(ctx, w, h, theme)
  drawConnections(ctx, model, theme)
  for (const node of model.getNodes()) {
    drawNode(ctx, node, theme)
  }
}

/* ────────────────────────────────────────────────
   React component
   ──────────────────────────────────────────────── */

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  graph,
  theme: themeProp,
  width = '100%',
  height = '600px',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const theme = buildTheme(themeProp)
    const model = GraphModel.fromJSON(graph)
    const dpr = window.devicePixelRatio || 1

    function paint() {
      const rect = canvas!.getBoundingClientRect()
      canvas!.width = rect.width * dpr
      canvas!.height = rect.height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      renderCanvas(ctx!, rect.width, rect.height, model, theme)
    }

    paint()

    const observer = new ResizeObserver(paint)
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
      }}
    />
  )
}
