import React, { useRef, useEffect } from 'react'
import type { FlowGraph, FlowNode } from '../types'
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

const NODE_W = 236
const HEADER_H = 40
const PIN_ROW = 30
const PIN_R = 5.5
const PIN_Y0 = 54
const PAD_BOTTOM = 20
const CORNER = 10
const ACCENT_W = 4
const GRID_STEP = 24
const GRID_MAJOR = 5
const FLOW_PARTICLES = 4
const FLOW_SPEED = 0.28

/* ═══════════════════════════════════════════════════════════
   Default theme — "Obsidian Engine"
   ═══════════════════════════════════════════════════════════ */

const PIN_COLORS: Record<string, string> = {
  exec:    '#c0c8d6',
  string:  '#f472b6',
  number:  '#34d399',
  boolean: '#fb923c',
  object:  '#60a5fa',
  array:   '#c084fc',
}

const DEFAULT_THEME: FlowTheme = {
  canvas: {
    background: '#08080e',
    grid: 'rgba(255,255,255,0.025)',
    gridMajor: 'rgba(255,255,255,0.06)',
  },
  node: {
    background: '#111128',
    border: 'rgba(255,255,255,0.055)',
    header: '#181840',
    text: '#e6eaf2',
    subtext: '#5a6a86',
    shadow: 'rgba(0,0,0,0.7)',
  },
  pin: PIN_COLORS,
  connection: {
    width: 2.5,
    glowSize: 10,
    glowOpacity: 0.2,
  },
}

/* ═══════════════════════════════════════════════════════════
   Color utilities
   ═══════════════════════════════════════════════════════════ */

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${bl})`
}

/* ═══════════════════════════════════════════════════════════
   Bezier math
   ═══════════════════════════════════════════════════════════ */

interface Vec2 { x: number; y: number }

function bezierControlPoints(from: Vec2, to: Vec2): [Vec2, Vec2] {
  const dx = Math.abs(to.x - from.x)
  const cp = Math.max(dx * 0.45, 80)
  return [
    { x: from.x + cp, y: from.y },
    { x: to.x - cp, y: to.y },
  ]
}

function cubicBezier(from: Vec2, cp1: Vec2, cp2: Vec2, to: Vec2, t: number): Vec2 {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: mt3 * from.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * to.x,
    y: mt3 * from.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * to.y,
  }
}

/* ═══════════════════════════════════════════════════════════
   Noise texture
   ═══════════════════════════════════════════════════════════ */

function createNoisePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const size = 150
  const offscreen = document.createElement('canvas')
  offscreen.width = size
  offscreen.height = size
  const octx = offscreen.getContext('2d')
  if (!octx) return null
  const img = octx.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 12
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 10
  }
  octx.putImageData(img, 0, 0)
  return ctx.createPattern(offscreen, 'repeat')
}

/* ═══════════════════════════════════════════════════════════
   Theme builder
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
  return theme.pin?.[type] ?? PIN_COLORS[type] ?? '#5a6a86'
}

function nodeHeight(node: FlowNode): number {
  const rows = Math.max(node.inputs.length, node.outputs.length)
  if (rows === 0) return HEADER_H + 28
  return PIN_Y0 + (rows - 1) * PIN_ROW + PIN_R + PAD_BOTTOM
}

function pinPos(node: FlowNode, pinId: string, isOutput: boolean): Vec2 | null {
  const list = isOutput ? node.outputs : node.inputs
  const idx = list.findIndex(p => p.id === pinId)
  if (idx < 0) return null
  return {
    x: node.position.x + (isOutput ? NODE_W : 0),
    y: node.position.y + PIN_Y0 + idx * PIN_ROW,
  }
}

/* ═══════════════════════════════════════════════════════════
   Drawing — Background layer
   ═══════════════════════════════════════════════════════════ */

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: FlowTheme,
  noise: CanvasPattern | null,
) {
  // Solid fill
  ctx.fillStyle = theme.canvas!.background!
  ctx.fillRect(0, 0, w, h)

  // Noise overlay
  if (noise) {
    ctx.save()
    ctx.fillStyle = noise
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // Grid — minor dots
  ctx.fillStyle = theme.canvas!.grid!
  for (let gx = GRID_STEP; gx < w; gx += GRID_STEP) {
    for (let gy = GRID_STEP; gy < h; gy += GRID_STEP) {
      ctx.beginPath()
      ctx.arc(gx, gy, 0.7, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Grid — major crosshairs
  const majorStep = GRID_STEP * GRID_MAJOR
  ctx.strokeStyle = theme.canvas!.gridMajor!
  ctx.lineWidth = 0.6
  for (let gx = majorStep; gx < w; gx += majorStep) {
    for (let gy = majorStep; gy < h; gy += majorStep) {
      const arm = 5
      ctx.beginPath()
      ctx.moveTo(gx - arm, gy)
      ctx.lineTo(gx + arm, gy)
      ctx.moveTo(gx, gy - arm)
      ctx.lineTo(gx, gy + arm)
      ctx.stroke()
    }
  }

  // Vignette
  const vig = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.62)
  vig.addColorStop(0, 'rgba(140,130,255,0.008)')
  vig.addColorStop(0.5, 'transparent')
  vig.addColorStop(1, 'rgba(0,0,0,0.2)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)
}

/* ═══════════════════════════════════════════════════════════
   Drawing — Pins (exec arrow + data ring)
   ═══════════════════════════════════════════════════════════ */

function drawExecPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // Arrow / pentagon pointing right
  const bw = 4.5
  const bh = 7
  const pw = 8

  // Outer glow
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = 6
  ctx.globalAlpha = 0.3
  ctx.beginPath()
  ctx.moveTo(cx - bw, cy - bh)
  ctx.lineTo(cx + 1, cy - bh)
  ctx.lineTo(cx + pw, cy)
  ctx.lineTo(cx + 1, cy + bh)
  ctx.lineTo(cx - bw, cy + bh)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()

  // Main shape
  ctx.beginPath()
  ctx.moveTo(cx - bw, cy - bh)
  ctx.lineTo(cx + 1, cy - bh)
  ctx.lineTo(cx + pw, cy)
  ctx.lineTo(cx + 1, cy + bh)
  ctx.lineTo(cx - bw, cy + bh)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  // Top edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(cx - bw, cy - bh)
  ctx.lineTo(cx + 1, cy - bh)
  ctx.lineTo(cx + pw, cy)
  ctx.stroke()
}

function drawDataPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // Outer glow ring
  ctx.beginPath()
  ctx.arc(cx, cy, PIN_R + 3.5, 0, Math.PI * 2)
  ctx.fillStyle = hexToRgba(color, 0.07)
  ctx.fill()

  // Mid ring
  ctx.beginPath()
  ctx.arc(cx, cy, PIN_R + 1.5, 0, Math.PI * 2)
  ctx.strokeStyle = hexToRgba(color, 0.25)
  ctx.lineWidth = 1
  ctx.stroke()

  // Main filled circle
  ctx.beginPath()
  ctx.arc(cx, cy, PIN_R, 0, Math.PI * 2)

  // Gradient fill
  const grad = ctx.createRadialGradient(cx - 1.5, cy - 1.5, 0, cx, cy, PIN_R)
  grad.addColorStop(0, lerpColor(color, '#ffffff', 0.3))
  grad.addColorStop(1, color)
  ctx.fillStyle = grad
  ctx.fill()

  // Rim light
  ctx.strokeStyle = hexToRgba('#ffffff', 0.15)
  ctx.lineWidth = 0.6
  ctx.stroke()
}

/* ═══════════════════════════════════════════════════════════
   Drawing — Nodes (multi-layer)
   ═══════════════════════════════════════════════════════════ */

function drawNode(ctx: CanvasRenderingContext2D, node: FlowNode, theme: FlowTheme) {
  const x = node.position.x
  const y = node.position.y
  const w = node.width ?? NODE_W
  const h = nodeHeight(node)
  const accent = node.color ?? '#6c63ff'

  // ── Drop shadow ──
  ctx.save()
  ctx.shadowColor = theme.node!.shadow!
  ctx.shadowBlur = 36
  ctx.shadowOffsetY = 12
  ctx.fillStyle = '#000'
  ctx.globalAlpha = 0.4
  ctx.beginPath()
  ctx.roundRect(x + 2, y + 4, w - 4, h - 4, CORNER)
  ctx.fill()
  ctx.restore()

  // ── Body fill ──
  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h)
  bodyGrad.addColorStop(0, theme.node!.background!)
  bodyGrad.addColorStop(1, hexToRgba(theme.node!.background!, 0.92))
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.fill()

  // ── Accent glow bleed into body ──
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()
  const accentBleed = ctx.createRadialGradient(x, y + HEADER_H / 2, 0, x, y + HEADER_H / 2, 100)
  accentBleed.addColorStop(0, hexToRgba(accent, 0.06))
  accentBleed.addColorStop(1, 'transparent')
  ctx.fillStyle = accentBleed
  ctx.fillRect(x, y, w, h)
  ctx.restore()

  // ── Border ──
  ctx.strokeStyle = theme.node!.border!
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.stroke()

  // ── Top edge highlight ──
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + CORNER, y + 0.5)
  ctx.lineTo(x + w - CORNER, y + 0.5)
  ctx.stroke()
  ctx.restore()

  // ── Header ──
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, HEADER_H, [CORNER, CORNER, 0, 0])
  ctx.clip()

  // Header base
  ctx.fillStyle = theme.node!.header!
  ctx.fillRect(x, y, w, HEADER_H)

  // Header gradient wash from accent
  const hdrGrad = ctx.createLinearGradient(x, y, x + w * 0.6, y)
  hdrGrad.addColorStop(0, hexToRgba(accent, 0.15))
  hdrGrad.addColorStop(0.5, hexToRgba(accent, 0.04))
  hdrGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = hdrGrad
  ctx.fillRect(x, y, w, HEADER_H)

  // Top light on header
  const topLight = ctx.createLinearGradient(x, y, x, y + 14)
  topLight.addColorStop(0, 'rgba(255,255,255,0.04)')
  topLight.addColorStop(1, 'transparent')
  ctx.fillStyle = topLight
  ctx.fillRect(x, y, w, 14)

  // Accent strip
  ctx.fillStyle = accent
  ctx.fillRect(x, y, ACCENT_W, HEADER_H)

  // Accent strip glow
  ctx.save()
  ctx.shadowColor = accent
  ctx.shadowBlur = 12
  ctx.shadowOffsetX = 4
  ctx.fillStyle = accent
  ctx.globalAlpha = 0.4
  ctx.fillRect(x, y + 4, ACCENT_W, HEADER_H - 8)
  ctx.restore()

  ctx.restore()

  // ── Header separator ──
  const sepGrad = ctx.createLinearGradient(x, y, x + w, y)
  sepGrad.addColorStop(0, hexToRgba(accent, 0.2))
  sepGrad.addColorStop(0.4, 'rgba(255,255,255,0.06)')
  sepGrad.addColorStop(1, 'rgba(255,255,255,0.02)')
  ctx.fillStyle = sepGrad
  ctx.fillRect(x, y + HEADER_H - 1, w, 1)

  // ── Title ──
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 2
  ctx.shadowOffsetY = 1
  ctx.fillStyle = theme.node!.text!
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(node.label, x + ACCENT_W + 14, y + HEADER_H / 2 + 0.5)
  ctx.restore()

  // ── Input pins ──
  node.inputs.forEach((pin, i) => {
    const py = y + PIN_Y0 + i * PIN_ROW
    const px = x

    const color = pinColor(pin.type, theme)
    if (pin.type === 'exec') {
      drawExecPin(ctx, px - 3, py, color)
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
      drawExecPin(ctx, px - 5, py, color)
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
   Drawing — Connections (gradient bezier + flow particles)
   ═══════════════════════════════════════════════════════════ */

function drawFlowParticles(
  ctx: CanvasRenderingContext2D,
  from: Vec2,
  cp1: Vec2,
  cp2: Vec2,
  to: Vec2,
  color: string,
  time: number,
) {
  for (let i = 0; i < FLOW_PARTICLES; i++) {
    const t = ((time * FLOW_SPEED + i / FLOW_PARTICLES) % 1)
    const pos = cubicBezier(from, cp1, cp2, to, t)

    // Fade at endpoints
    const fade = Math.min(t * 6, (1 - t) * 6, 1)
    if (fade <= 0) continue

    // Glow
    ctx.save()
    ctx.globalAlpha = fade * 0.5
    ctx.shadowColor = color
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.restore()

    // Bright core
    ctx.save()
    ctx.globalAlpha = fade * 0.9
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.restore()
  }
}

function drawConnection(
  ctx: CanvasRenderingContext2D,
  from: Vec2,
  to: Vec2,
  fromColor: string,
  toColor: string,
  lineWidth: number,
  glowSize: number,
  glowOpacity: number,
  time: number,
) {
  const [cp1, cp2] = bezierControlPoints(from, to)

  // Gradient for the line
  const grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y)
  grad.addColorStop(0, fromColor)
  grad.addColorStop(1, toColor)

  // Shadow pass
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 4
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y)
  ctx.strokeStyle = 'rgba(0,0,0,0.01)'
  ctx.lineWidth = lineWidth + 2
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()

  // Glow pass
  ctx.save()
  ctx.globalAlpha = glowOpacity
  ctx.shadowColor = fromColor
  ctx.shadowBlur = glowSize
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y)
  ctx.strokeStyle = grad
  ctx.lineWidth = lineWidth + 5
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()

  // Main line
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, to.x, to.y)
  ctx.strokeStyle = grad
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.stroke()

  // Flow particles
  drawFlowParticles(ctx, from, cp1, cp2, to, fromColor, time)
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  model: GraphModel,
  theme: FlowTheme,
  time: number,
) {
  const nodes = model.getNodes()

  for (const conn of model.getConnections()) {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId)
    const toNode = nodes.find(n => n.id === conn.toNodeId)
    if (!fromNode || !toNode) continue

    const fromP = pinPos(fromNode, conn.fromPinId, true)
    const toP = pinPos(toNode, conn.toPinId, false)
    if (!fromP || !toP) continue

    const fromPin = fromNode.outputs.find(p => p.id === conn.fromPinId)
    const toPin = toNode.inputs.find(p => p.id === conn.toPinId)
    const fromC = fromPin ? pinColor(fromPin.type, theme) : '#6c63ff'
    const toC = toPin ? pinColor(toPin.type, theme) : fromC

    drawConnection(
      ctx, fromP, toP, fromC, toC,
      theme.connection!.width as number,
      theme.connection!.glowSize as number,
      theme.connection!.glowOpacity as number,
      time,
    )
  }
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
  noise: CanvasPattern | null,
  time: number,
) {
  // 1 — Background + grid + vignette
  drawBackground(ctx, w, h, theme, noise)

  // 2 — Connections (behind nodes)
  drawConnections(ctx, model, theme, time)

  // 3 — Nodes
  for (const node of model.getNodes()) {
    drawNode(ctx, node, theme)
  }
}

/* ═══════════════════════════════════════════════════════════
   React component — animated render loop
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
  const frameRef = useRef<number>(0)
  const noiseRef = useRef<CanvasPattern | null>(null)
  const dimRef = useRef({ w: 0, h: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const theme = buildTheme(themeProp)
    const model = GraphModel.fromJSON(graph)

    // Create noise texture once
    if (!noiseRef.current) {
      noiseRef.current = createNoisePattern(ctx)
    }

    const dpr = window.devicePixelRatio || 1

    // Size the canvas
    function resize() {
      const rect = canvas!.getBoundingClientRect()
      dimRef.current = { w: rect.width, h: rect.height }
      canvas!.width = rect.width * dpr
      canvas!.height = rect.height * dpr
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    // Animation loop
    const startTime = performance.now()

    function animate() {
      const elapsed = (performance.now() - startTime) / 1000
      const { w, h } = dimRef.current
      if (w === 0 || h === 0) {
        frameRef.current = requestAnimationFrame(animate)
        return
      }

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      renderCanvas(ctx!, w, h, model, theme, noiseRef.current, elapsed)
      frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameRef.current)
      observer.disconnect()
    }
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
