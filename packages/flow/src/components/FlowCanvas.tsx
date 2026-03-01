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
    gridColor?: string
    gridMajorColor?: string
    gridSpacing?: number
    gridMajorEvery?: number
  }
  node?: {
    background?: string
    border?: string
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
    execWidth?: number
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

const NODE_W = 220
const HEADER_H = 32
const PIN_ROW = 24
const PIN_R = 4
const PIN_Y0 = HEADER_H + 14
const PAD_BOTTOM = 14
const CORNER = 6
const GRID_SPACING = 20
const GRID_MAJOR_EVERY = 8

/* ────────────────────────────────────────────────
   Default theme
   ──────────────────────────────────────────────── */

const PIN_COLORS: Record<string, string> = {
  exec:    '#ffffff',
  string:  '#f472b6',
  number:  '#34d399',
  boolean: '#fb923c',
  object:  '#60a5fa',
  array:   '#c084fc',
}

const DEFAULT_THEME: Required<FlowTheme> = {
  canvas: {
    background: '#1a1a1a',
    gridColor: 'rgba(255,255,255,0.03)',
    gridMajorColor: 'rgba(255,255,255,0.07)',
    gridSpacing: GRID_SPACING,
    gridMajorEvery: GRID_MAJOR_EVERY,
  },
  node: {
    background: '#252530',
    border: 'rgba(255,255,255,0.08)',
    text: '#ffffff',
    subtext: '#9ca3af',
  },
  pin: PIN_COLORS,
  connection: {
    width: 1.8,
    execColor: 'rgba(255,255,255,0.6)',
    execWidth: 2,
  },
}

/* ────────────────────────────────────────────────
   Utilities
   ──────────────────────────────────────────────── */

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

function buildConnectedPins(graph: FlowGraph): Set<string> {
  const set = new Set<string>()
  for (const c of graph.connections) {
    set.add(`${c.fromNodeId}:${c.fromPinId}:out`)
    set.add(`${c.toNodeId}:${c.toPinId}:in`)
  }
  return set
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, theme: FlowTheme) {
  ctx.fillStyle = theme.canvas!.background!
  ctx.fillRect(0, 0, w, h)

  const sp = theme.canvas!.gridSpacing ?? GRID_SPACING
  const majorEvery = theme.canvas!.gridMajorEvery ?? GRID_MAJOR_EVERY
  const majorSp = sp * majorEvery

  // Fine grid lines
  ctx.strokeStyle = theme.canvas!.gridColor!
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let x = sp; x < w; x += sp) {
    if (x % majorSp === 0) continue
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = sp; y < h; y += sp) {
    if (y % majorSp === 0) continue
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()

  // Major grid lines
  ctx.strokeStyle = theme.canvas!.gridMajorColor!
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = majorSp; x < w; x += majorSp) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = majorSp; y < h; y += majorSp) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()
}

/* ────────────────────────────────────────────────
   Pins — triangle (exec) / circle (data)
   ──────────────────────────────────────────────── */

function drawExecPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, connected: boolean) {
  const hw = 4.5
  const hh = 5.5
  ctx.beginPath()
  ctx.moveTo(cx - hw, cy - hh)
  ctx.lineTo(cx + hw + 1, cy)
  ctx.lineTo(cx - hw, cy + hh)
  ctx.closePath()
  if (connected) {
    ctx.fillStyle = color
    ctx.fill()
  } else {
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

function drawDataPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, connected: boolean) {
  ctx.beginPath()
  ctx.arc(cx, cy, PIN_R, 0, Math.PI * 2)
  if (connected) {
    ctx.fillStyle = color
    ctx.fill()
  } else {
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

/* ────────────────────────────────────────────────
   Node
   ──────────────────────────────────────────────── */

function drawNode(ctx: CanvasRenderingContext2D, node: FlowNode, theme: FlowTheme, connectedPins: Set<string>) {
  const x = node.position.x
  const y = node.position.y
  const w = node.width ?? NODE_W
  const h = nodeHeight(node)
  const accent = node.color ?? '#6c63ff'

  // Shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 3
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

  // Header — full color, clipped to node shape
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()
  ctx.fillStyle = accent
  ctx.fillRect(x, y, w, HEADER_H)
  ctx.restore()

  // Border
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.strokeStyle = theme.node!.border!
  ctx.lineWidth = 1
  ctx.stroke()

  // Title — white on colored header
  ctx.fillStyle = theme.node!.text!
  ctx.font = '600 12px -apple-system, "Segoe UI", system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(node.label, x + 12, y + HEADER_H / 2)

  // Input pins
  node.inputs.forEach((pin, i) => {
    const py = y + PIN_Y0 + i * PIN_ROW
    const px = x
    const col = pinColor(pin.type, theme)
    const connected = connectedPins.has(`${node.id}:${pin.id}:in`)

    if (pin.type === 'exec') {
      drawExecPin(ctx, px, py, col, connected)
    } else {
      drawDataPin(ctx, px, py, col, connected)
    }

    if (pin.label) {
      ctx.fillStyle = theme.node!.subtext!
      ctx.font = '11px -apple-system, "Segoe UI", system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(pin.label, px + 12, py)
    }
  })

  // Output pins
  node.outputs.forEach((pin, i) => {
    const py = y + PIN_Y0 + i * PIN_ROW
    const px = x + w
    const col = pinColor(pin.type, theme)
    const connected = connectedPins.has(`${node.id}:${pin.id}:out`)

    if (pin.type === 'exec') {
      drawExecPin(ctx, px, py, col, connected)
    } else {
      drawDataPin(ctx, px, py, col, connected)
    }

    if (pin.label) {
      ctx.fillStyle = theme.node!.subtext!
      ctx.font = '11px -apple-system, "Segoe UI", system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(pin.label, px - 12, py)
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
      ? (theme.connection!.execColor ?? 'rgba(255,255,255,0.6)')
      : pinColor(fromPin?.type ?? 'string', theme)
    const lw = isExec
      ? (theme.connection!.execWidth ?? 2)
      : (theme.connection!.width ?? 1.8)

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
  connectedPins: Set<string>,
) {
  drawBackground(ctx, w, h, theme)
  drawConnections(ctx, model, theme)
  for (const node of model.getNodes()) {
    drawNode(ctx, node, theme, connectedPins)
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
    const connectedPins = buildConnectedPins(graph)
    const dpr = window.devicePixelRatio || 1

    function paint() {
      const rect = canvas!.getBoundingClientRect()
      canvas!.width = rect.width * dpr
      canvas!.height = rect.height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      renderCanvas(ctx!, rect.width, rect.height, model, theme, connectedPins)
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
