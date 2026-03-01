import React, { useRef, useEffect } from 'react'
import type { FlowGraph, FlowNode } from '../types'
import type { NodeDefinitionWithFactory } from '../define'
import { GraphModel } from '../model/GraphModel'

export interface FlowTheme {
  canvas?: { background?: string }
  node?: { background?: string; border?: string; text?: string; subtext?: string }
  pin?: { exec?: string; string?: string; number?: string; boolean?: string; object?: string; array?: string; [k: string]: string | undefined }
  connection?: { width?: number; execColor?: string }
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

/* ── constants (matching Claude Terminal proportions) ── */

const W = 220
const HDR = 30
const ROW = 22
const PY0 = HDR + 12
const PAD = 12
const R = 8

const COLORS: Record<string, string> = {
  exec: '#9ca3af', string: '#f472b6', number: '#34d399',
  boolean: '#fb923c', object: '#60a5fa', array: '#c084fc',
}

const D = {
  bg: '#0e0e12',
  nodeBody: '#181a24',
  nodeBorder: 'rgba(255,255,255,0.06)',
  text: '#e0e2e8',
  sub: '#6b7280',
  execWire: 'rgba(255,255,255,0.35)',
  wireW: 1.6,
}

/* ── helpers ── */

function pc(t: string, th: FlowTheme): string { return th.pin?.[t] ?? COLORS[t] ?? '#6b7280' }
function nh(n: FlowNode): number {
  const rows = Math.max(n.inputs.length, n.outputs.length)
  return rows === 0 ? HDR + 14 : PY0 + (rows - 1) * ROW + 4 + PAD
}
function hexRgba(hex: string, a: number): string {
  return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`
}

interface V { x: number; y: number }

function pp(n: FlowNode, pid: string, out: boolean): V | null {
  const list = out ? n.outputs : n.inputs
  const i = list.findIndex(p => p.id === pid)
  if (i < 0) return null
  return { x: n.position.x + (out ? W : 0), y: n.position.y + PY0 + i * ROW }
}

function bcp(a: V, b: V): [V, V] {
  const o = Math.max(Math.abs(b.x - a.x) * 0.45, 50)
  return [{ x: a.x + o, y: a.y }, { x: b.x - o, y: b.y }]
}

function connSet(g: FlowGraph): Set<string> {
  const s = new Set<string>()
  for (const c of g.connections) {
    s.add(`${c.fromNodeId}:${c.fromPinId}:o`)
    s.add(`${c.toNodeId}:${c.toPinId}:i`)
  }
  return s
}

function mg<T extends Record<string, unknown>>(b: T, o?: Partial<T>): T {
  if (!o) return b
  const r = { ...b }
  for (const k of Object.keys(o)) if ((o as any)[k] !== undefined) (r as any)[k] = (o as any)[k]
  return r
}

function bt(c?: FlowTheme) {
  return {
    canvas: mg({ background: D.bg }, c?.canvas),
    node: mg({ background: D.nodeBody, border: D.nodeBorder, text: D.text, subtext: D.sub }, c?.node),
    pin: { ...COLORS, ...c?.pin },
    connection: mg({ width: D.wireW, execColor: D.execWire }, c?.connection),
  } as FlowTheme
}

/* ── background ── */

function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number, th: FlowTheme) {
  ctx.fillStyle = th.canvas!.background!
  ctx.fillRect(0, 0, w, h)
  // very subtle dot grid like Claude Terminal
  ctx.fillStyle = 'rgba(255,255,255,0.025)'
  for (let x = 20; x < w; x += 20)
    for (let y = 20; y < h; y += 20) {
      ctx.beginPath(); ctx.arc(x, y, 0.6, 0, 6.28); ctx.fill()
    }
}

/* ── pins ── */

function drawExec(ctx: CanvasRenderingContext2D, cx: number, cy: number, col: string, on: boolean) {
  // diamond shape like Claude Terminal
  const s = 4
  ctx.beginPath()
  ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy)
  ctx.closePath()
  if (on) { ctx.fillStyle = col; ctx.fill() }
  else { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke() }
}

function drawData(ctx: CanvasRenderingContext2D, cx: number, cy: number, col: string, on: boolean) {
  ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, 6.28)
  if (on) { ctx.fillStyle = col; ctx.fill() }
  else { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke() }
}

/* ── node ── */

function drawNode(ctx: CanvasRenderingContext2D, n: FlowNode, th: FlowTheme, cs: Set<string>) {
  const x = n.position.x, y = n.position.y, w = n.width ?? W, h = nh(n)
  const accent = n.color ?? '#6c63ff'

  // shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4
  ctx.beginPath(); ctx.roundRect(x, y, w, h, R)
  ctx.fillStyle = th.node!.background!; ctx.fill()
  ctx.restore()

  // body
  ctx.beginPath(); ctx.roundRect(x, y, w, h, R)
  ctx.fillStyle = th.node!.background!; ctx.fill()

  // header: subtle tint + accent bar (Claude Terminal style)
  ctx.save()
  ctx.beginPath(); ctx.roundRect(x, y, w, h, R); ctx.clip()
  // subtle tint
  ctx.fillStyle = hexRgba(accent, 0.08)
  ctx.fillRect(x, y, w, HDR)
  // left accent bar
  ctx.fillStyle = accent
  ctx.fillRect(x, y, 3, HDR)
  ctx.restore()

  // border
  ctx.beginPath(); ctx.roundRect(x, y, w, h, R)
  ctx.strokeStyle = th.node!.border!; ctx.lineWidth = 1; ctx.stroke()

  // header separator
  ctx.beginPath(); ctx.moveTo(x, y + HDR); ctx.lineTo(x + w, y + HDR)
  ctx.strokeStyle = th.node!.border!; ctx.lineWidth = 1; ctx.stroke()

  // accent dot + title
  ctx.beginPath(); ctx.arc(x + 12, y + HDR / 2, 2.5, 0, 6.28)
  ctx.fillStyle = accent; ctx.fill()

  ctx.fillStyle = th.node!.text!
  ctx.font = '600 11.5px -apple-system,"Segoe UI",system-ui,sans-serif'
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  ctx.fillText(n.label, x + 20, y + HDR / 2)

  // pins
  const drawPins = (list: typeof n.inputs, isOut: boolean) => {
    list.forEach((pin, i) => {
      const py = y + PY0 + i * ROW
      const px = isOut ? x + w : x
      const col = pc(pin.type, th)
      const on = cs.has(`${n.id}:${pin.id}:${isOut ? 'o' : 'i'}`)

      if (pin.type === 'exec') drawExec(ctx, px, py, col, on)
      else drawData(ctx, px, py, col, on)

      if (pin.label) {
        ctx.fillStyle = th.node!.subtext!
        ctx.font = '10.5px -apple-system,"Segoe UI",system-ui,sans-serif'
        ctx.textAlign = isOut ? 'right' : 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(pin.label, isOut ? px - 10 : px + 10, py)
      }
    })
  }
  drawPins(n.inputs, false)
  drawPins(n.outputs, true)
}

/* ── connections ── */

function drawWire(ctx: CanvasRenderingContext2D, a: V, b: V, col: string, lw: number) {
  const [c1, c2] = bcp(a, b)
  ctx.beginPath(); ctx.moveTo(a.x, a.y)
  ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y)
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke()
}

function drawConns(ctx: CanvasRenderingContext2D, m: GraphModel, th: FlowTheme) {
  const nodes = m.getNodes()
  for (const c of m.getConnections()) {
    const fn = nodes.find(n => n.id === c.fromNodeId)
    const tn = nodes.find(n => n.id === c.toNodeId)
    if (!fn || !tn) continue
    const fp = pp(fn, c.fromPinId, true), tp = pp(tn, c.toPinId, false)
    if (!fp || !tp) continue
    const pin = fn.outputs.find(p => p.id === c.fromPinId)
    const exec = pin?.type === 'exec'
    drawWire(ctx, fp, tp,
      exec ? (th.connection!.execColor ?? D.execWire) : pc(pin?.type ?? 'string', th),
      exec ? 1.8 : (th.connection!.width as number ?? D.wireW))
  }
}

/* ── render ── */

function render(ctx: CanvasRenderingContext2D, w: number, h: number, m: GraphModel, th: FlowTheme, cs: Set<string>) {
  drawBg(ctx, w, h, th)
  drawConns(ctx, m, th)
  for (const n of m.getNodes()) drawNode(ctx, n, th, cs)
}

/* ── component ── */

export const FlowCanvas: React.FC<FlowCanvasProps> = ({ graph, theme: tp, width = '100%', height = '600px' }) => {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cvs = ref.current; if (!cvs) return
    const ctx = cvs.getContext('2d'); if (!ctx) return
    const th = bt(tp), model = GraphModel.fromJSON(graph), cs = connSet(graph)
    const dpr = window.devicePixelRatio || 1

    function paint() {
      const r = cvs!.getBoundingClientRect()
      cvs!.width = r.width * dpr; cvs!.height = r.height * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      render(ctx!, r.width, r.height, model, th, cs)
    }
    paint()
    const ob = new ResizeObserver(paint); ob.observe(cvs)
    return () => ob.disconnect()
  }, [graph, tp])

  return <canvas ref={ref} style={{
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    display: 'block',
  }} />
}
