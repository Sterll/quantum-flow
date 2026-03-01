import React, { useRef, useEffect } from 'react'
import type { FlowGraph, FlowNode, FlowPin } from '../types'
import type { NodeDefinitionWithFactory } from '../define'
import { GraphStore } from '../model/GraphStore'

/* ══════════════════════════════════════════════════════════════
   FlowCanvas — Claude Terminal WorkflowGraphEngine port
   Faithful reproduction of the Claude Terminal rendering style.
   ══════════════════════════════════════════════════════════════ */

export interface FlowTheme {
  canvas?: { background?: string; gridColor?: string }
  node?: { titleBar?: string; body?: string; border?: string; text?: string; subtext?: string }
  pin?: { exec?: string; string?: string; number?: string; boolean?: string; object?: string; array?: string; [k: string]: string | undefined }
  connection?: { width?: number; opacity?: number }
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

function nodeHeight(node: FlowNode): number {
  const rows = Math.max(node.inputs.length, node.outputs.length)
  return rows === 0 ? TITLE_H + 14 : PIN_Y0 + rows * SLOT_H + 8
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

function buildConnectedPins(graph: FlowGraph): Set<string> {
  const set = new Set<string>()
  for (const c of graph.connections) {
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
  }
}

/* ── grid (from Claude Terminal _drawGrid) ── */

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, theme: FlowTheme) {
  ctx.fillStyle = theme.canvas!.background!
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = theme.canvas!.gridColor!
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let x = GRID_SIZE; x < w; x += GRID_SIZE) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = GRID_SIZE; y < h; y += GRID_SIZE) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()
}

/* ── pins (from Claude Terminal _drawPins) ── */

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
        // Diamond shape (from Claude Terminal)
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
        // Circle data pin (from Claude Terminal)
        ctx.beginPath()
        ctx.arc(px, py, PIN_R, 0, Math.PI * 2)
        if (connected) {
          // Filled with glow
          ctx.save()
          ctx.shadowColor = color
          ctx.shadowBlur = 6
          ctx.fillStyle = color
          ctx.fill()
          ctx.restore()
        } else {
          // Hollow stroke
          ctx.strokeStyle = hexToRgba(color, 0.6)
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      // Pin label (from Claude Terminal: colored by type, 500 11px)
      if (pin.label) {
        ctx.fillStyle = hexToRgba(color, 0.7)
        ctx.font = `500 11px ${FONT}`
        ctx.textAlign = isOutput ? 'right' : 'left'
        ctx.textBaseline = 'middle'
        const labelX = isOutput ? px - 12 : px + 12
        ctx.fillText(pin.label, labelX, py)

        // Type name below label (from Claude Terminal: 400 9px, 0.3 opacity)
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

/* ── node (from Claude Terminal _drawNode) ── */

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: FlowNode,
  theme: FlowTheme,
  connectedPins: Set<string>,
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

  // Title bar — separate shape, #141416 base
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()

  // Title bar base
  ctx.fillStyle = theme.node!.titleBar!
  ctx.fillRect(x, y, w, TITLE_H)

  // Accent tint overlay on title (0.18 opacity — from Claude Terminal)
  ctx.fillStyle = hexToRgba(accent, 0.18)
  ctx.fillRect(x, y, w, TITLE_H)

  // Top accent stripe — 2px (from Claude Terminal)
  ctx.fillStyle = accent
  ctx.fillRect(x, y, w, 2)

  ctx.restore()

  // Body — #101012, separate from title
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()

  ctx.fillStyle = theme.node!.body!
  ctx.fillRect(x, y + TITLE_H, w, h - TITLE_H)

  // Accent gradient bleed at top of body (from Claude Terminal)
  const gradient = ctx.createLinearGradient(x, y + TITLE_H, x, y + TITLE_H + 18)
  gradient.addColorStop(0, hexToRgba(accent, 0.06))
  gradient.addColorStop(1, 'transparent')
  ctx.fillStyle = gradient
  ctx.fillRect(x, y + TITLE_H, w, 18)

  ctx.restore()

  // Border — very subtle (from Claude Terminal: rgba(255,255,255,.04), 0.5)
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.strokeStyle = theme.node!.border!
  ctx.lineWidth = 0.5
  ctx.stroke()

  // Title dot with glow (from Claude Terminal: shadowBlur 4)
  ctx.save()
  ctx.shadowColor = accent
  ctx.shadowBlur = 4
  ctx.beginPath()
  ctx.arc(x + 12, y + TITLE_H * 0.5, 4, 0, Math.PI * 2)
  ctx.fillStyle = accent
  ctx.fill()
  ctx.restore()

  // Title text (from Claude Terminal: 600 12px, #bbb)
  ctx.fillStyle = theme.node!.text!
  ctx.font = `600 12px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(node.label, x + 22, y + TITLE_H * 0.5)

  // Draw pins
  drawPins(ctx, node, theme, connectedPins)
}

/* ── connections (from Claude Terminal _drawLinks) ── */

function drawConnections(ctx: CanvasRenderingContext2D, model: GraphStore, theme: FlowTheme) {
  const nodes = model.getNodes()

  ctx.save()
  ctx.globalAlpha = theme.connection!.opacity as number
  ctx.lineWidth = theme.connection!.width as number
  ctx.lineCap = 'round'

  for (const conn of model.getConnections()) {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId)
    const toNode = nodes.find(n => n.id === conn.toNodeId)
    if (!fromNode || !toNode) continue

    const fromP = pinPos(fromNode, conn.fromPinId, true)
    const toP = pinPos(toNode, conn.toPinId, false)
    if (!fromP || !toP) continue

    const fromPin = fromNode.outputs.find(p => p.id === conn.fromPinId)
    const color = pinColor(fromPin?.type ?? 'exec', theme)

    // Bezier with dx * 0.5 control points (from Claude Terminal)
    const dx = Math.abs(toP.x - fromP.x)
    const offset = Math.max(dx * 0.5, 60)

    ctx.beginPath()
    ctx.moveTo(fromP.x, fromP.y)
    ctx.bezierCurveTo(
      fromP.x + offset, fromP.y,
      toP.x - offset, toP.y,
      toP.x, toP.y,
    )
    ctx.strokeStyle = color
    ctx.stroke()
  }

  ctx.restore()
}

/* ── render ── */

function renderCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  model: GraphStore,
  theme: FlowTheme,
  connectedPins: Set<string>,
) {
  drawGrid(ctx, w, h, theme)
  drawConnections(ctx, model, theme)
  for (const node of model.getNodes()) {
    drawNode(ctx, node, theme, connectedPins)
  }
}

/* ── component ── */

export const FlowCanvas: React.FC<FlowCanvasProps> = ({ graph, theme: customTheme, width = '100%', height = '600px' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const theme = buildTheme(customTheme)
    const model = new GraphStore()
    model.importGraph(graph)
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
  }, [graph, customTheme])

  return <canvas ref={canvasRef} style={{
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    display: 'block',
  }} />
}
