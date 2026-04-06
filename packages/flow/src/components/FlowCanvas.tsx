import React, { useRef, useEffect, useMemo, useState } from 'react'
import type { FlowNode, FlowPin, FlowConnection, FlowWaypoint } from '../types'
import type { GraphStore } from '../model/GraphStore'
import { useCanvasInteraction, type HoverPin, type ContextMenuEvent } from '../hooks/useCanvasInteraction'
import { nodeHeight, GROUP_NODE_TYPE } from '../hooks/hitTest'
import type { DraftConnection } from '../hooks/useConnection'
import type { Rect } from '../hooks/useSelection'
import type { AlignmentGuide } from '../hooks/useNodeDrag'
import { Minimap } from './Minimap'
import { SearchPalette, type SearchPaletteItem } from './SearchPalette'
import type { PinTypeRegistry } from '../plugin/PinTypeRegistry'
import {
  NODE_W, TITLE_H, SLOT_H, PIN_Y0, CORNER, PIN_R, EXEC_R, GRID,
  GROUP_HEADER_H, BEZIER_MIN_OFFSET,
} from '../constants'

/* ══════════════════════════════════════════════════════════════
   FlowCanvas - Quantum Flow Node Editor
   ══════════════════════════════════════════════════════════════ */

export interface FlowTheme {
  canvas?: { background?: string; dotColor?: string; dotMajor?: string }
  node?: { body?: string; border?: string; text?: string }
  pin?: { exec?: string; string?: string; number?: string; boolean?: string; object?: string; array?: string; [k: string]: string | undefined }
  connection?: { width?: number }
  selection?: { color?: string }
}

export interface ExportImageOptions {
  padding?: number
  scale?: number
  background?: string
}

export interface FlowCanvasProps {
  store: GraphStore
  theme?: FlowTheme
  readOnly?: boolean
  snapToGrid?: number
  onSelectionChange?: (ids: Set<string>) => void
  onFitView?: (fitView: () => void) => void
  onContextMenu?: (event: ContextMenuEvent) => void
  showMinimap?: boolean
  snapToAlignment?: boolean
  alignThreshold?: number
  onExportImage?: (exportFn: (options?: ExportImageOptions) => string) => void
  animateConnections?: boolean
  onGroup?: (nodeIds: string[]) => void
  searchPalette?: {
    items: SearchPaletteItem[]
    onSelect: (item: SearchPaletteItem, worldPos: { x: number; y: number }) => void
  }
  pinTypes?: PinTypeRegistry
  width?: number | string
  height?: number | string
}

/* -- layout -- */

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'

/* -- palette -- */

const PIN_PALETTE: Record<string, string> = {
  exec:    '#71717a',
  string:  '#a78bfa',
  number:  '#34d399',
  boolean: '#fbbf24',
  object:  '#60a5fa',
  array:   '#f472b6',
}

const D = {
  bg:       '#0c0c10',
  dotColor: 'rgba(255,255,255,0.025)',
  dotMajor: 'rgba(255,255,255,0.05)',
  body:     '#161620',
  border:   'rgba(255,255,255,0.05)',
  text:     '#e0e0e8',
  sel:      '#3b82f6',
  wireW:    1.8,
}

/* -- helpers -- */

function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function pColor(type: string, t: FlowTheme, ptr?: PinTypeRegistry | null): string {
  if (ptr) {
    const info = ptr.get(type)
    if (info) return info.color
  }
  return t.pin?.[type] ?? PIN_PALETTE[type] ?? '#6b7280'
}

interface V2 { x: number; y: number }

function pinXY(node: FlowNode, pinId: string, isOut: boolean): V2 | null {
  const list = isOut ? node.outputs : node.inputs
  const idx = list.findIndex(p => p.id === pinId)
  if (idx < 0) return null
  return {
    x: node.position.x + (isOut ? (node.width ?? NODE_W) : 0),
    y: node.position.y + PIN_Y0 + idx * SLOT_H + SLOT_H * 0.5,
  }
}

function connectedSet(connections: Array<{ fromNodeId: string; fromPinId: string; toNodeId: string; toPinId: string }>): Set<string> {
  const s = new Set<string>()
  for (const c of connections) {
    s.add(`${c.fromNodeId}:${c.fromPinId}:o`)
    s.add(`${c.toNodeId}:${c.toPinId}:i`)
  }
  return s
}

function buildTheme(c?: FlowTheme): FlowTheme {
  return {
    canvas: { background: c?.canvas?.background ?? D.bg, dotColor: c?.canvas?.dotColor ?? D.dotColor, dotMajor: c?.canvas?.dotMajor ?? D.dotMajor },
    node: { body: c?.node?.body ?? D.body, border: c?.node?.border ?? D.border, text: c?.node?.text ?? D.text },
    pin: { ...PIN_PALETTE, ...c?.pin },
    connection: { width: c?.connection?.width ?? D.wireW },
    selection: { color: c?.selection?.color ?? D.sel },
  }
}

function badge(node: FlowNode): string {
  const i = node.type.indexOf('/')
  return i > 0 ? node.type.slice(0, i).toUpperCase() : ''
}

/* -- compatible pin preview -- */

interface DraftPinInfo {
  sourceNodeId: string
  sourceType: string
  isFromOutput: boolean
}

function resolveDraftInfo(draft: DraftConnection, nodes: FlowNode[]): DraftPinInfo | null {
  const sn = nodes.find(n => n.id === draft.fromNodeId)
  if (!sn) return null
  const sp = draft.isFromOutput
    ? sn.outputs.find(p => p.id === draft.fromPinId)
    : sn.inputs.find(p => p.id === draft.fromPinId)
  if (!sp) return null
  return { sourceNodeId: draft.fromNodeId, sourceType: sp.type, isFromOutput: draft.isFromOutput }
}

function isPinCompatible(candidateType: string, candidateIsOutput: boolean, info: DraftPinInfo): boolean {
  if (candidateIsOutput === info.isFromOutput) return false
  if (info.sourceType === 'exec') return candidateType === 'exec'
  if (candidateType === 'exec') return false
  return candidateType === info.sourceType
}

/* -- grid -- */

function drawGrid(ctx: CanvasRenderingContext2D, cw: number, ch: number, t: FlowTheme, ox: number, oy: number, zoom: number) {
  ctx.fillStyle = t.canvas!.background!
  ctx.fillRect(0, 0, cw, ch)

  const gs = GRID * zoom
  if (gs < 8) return

  const sx = ox % gs
  const sy = oy % gs
  const dr = Math.max(0.6, gs / 28)

  ctx.fillStyle = t.canvas!.dotColor!
  for (let x = sx; x < cw; x += gs) {
    for (let y = sy; y < ch; y += gs) {
      ctx.beginPath()
      ctx.arc(x, y, dr, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (gs >= 10) {
    const ms = gs * 5
    const mx = ox % ms
    const my = oy % ms
    ctx.fillStyle = t.canvas!.dotMajor!
    for (let x = mx; x < cw; x += ms) {
      for (let y = my; y < ch; y += ms) {
        ctx.beginPath()
        ctx.arc(x, y, dr * 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

/* -- groups -- */

function drawGroups(ctx: CanvasRenderingContext2D, nodes: FlowNode[], t: FlowTheme, selected: Set<string>) {
  const sel = t.selection!.color!

  for (const node of nodes) {
    if (node.type !== GROUP_NODE_TYPE) continue

    const x = node.position.x
    const y = node.position.y
    const gw = (node.data.groupWidth as number) ?? 300
    const gh = (node.data.groupHeight as number) ?? 200
    const color = (node.data.groupColor as string) ?? '#6366f1'
    const label = node.label
    const isSel = selected.has(node.id)

    ctx.save()

    // Body fill
    ctx.beginPath()
    ctx.roundRect(x, y, gw, gh, 12)
    ctx.fillStyle = rgba(color, 0.05)
    ctx.fill()

    // Header band
    ctx.beginPath()
    ctx.roundRect(x, y, gw, GROUP_HEADER_H, [12, 12, 0, 0])
    ctx.fillStyle = rgba(color, 0.12)
    ctx.fill()

    // Border
    ctx.beginPath()
    ctx.roundRect(x + 0.5, y + 0.5, gw - 1, gh - 1, 12)
    ctx.strokeStyle = isSel ? rgba(sel, 0.35) : rgba(color, 0.2)
    ctx.lineWidth = isSel ? 1.5 : 1
    ctx.setLineDash(isSel ? [] : [6, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // Label
    ctx.fillStyle = rgba(color, 0.65)
    ctx.font = `600 11px ${FONT}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText(label, x + 14, y + GROUP_HEADER_H * 0.5)

    // Resize handle indicator (bottom-right)
    ctx.beginPath()
    ctx.moveTo(x + gw - 4, y + gh - 12)
    ctx.lineTo(x + gw - 4, y + gh - 4)
    ctx.lineTo(x + gw - 12, y + gh - 4)
    ctx.strokeStyle = rgba(color, 0.2)
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.restore()
  }
}

/* -- pins -- */

function drawDataPin(ctx: CanvasRenderingContext2D, px: number, py: number, color: string, filled: boolean, hover: boolean) {
  const r = hover ? PIN_R + 0.5 : PIN_R

  if (hover) {
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(px, py, r + 4, 0, Math.PI * 2)
    ctx.fillStyle = rgba(color, 0.05)
    ctx.fill()
    ctx.restore()
  }

  ctx.beginPath()
  ctx.arc(px, py, r, 0, Math.PI * 2)

  if (filled) {
    ctx.save()
    ctx.shadowColor = rgba(color, 0.35)
    ctx.shadowBlur = 5
    ctx.fillStyle = color
    ctx.fill()
    ctx.restore()
  } else {
    ctx.strokeStyle = rgba(color, hover ? 0.55 : 0.28)
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

function drawExecPin(ctx: CanvasRenderingContext2D, px: number, py: number, filled: boolean, hover: boolean) {
  const r = hover ? EXEC_R + 0.5 : EXEC_R

  if (hover) {
    ctx.save()
    ctx.shadowColor = 'rgba(200,200,220,0.25)'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(px, py, r + 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(200,200,220,0.04)'
    ctx.fill()
    ctx.restore()
  }

  ctx.beginPath()
  ctx.moveTo(px, py - r)
  ctx.lineTo(px + r, py)
  ctx.lineTo(px, py + r)
  ctx.lineTo(px - r, py)
  ctx.closePath()

  if (filled) {
    ctx.save()
    ctx.shadowColor = 'rgba(200,200,220,0.25)'
    ctx.shadowBlur = 4
    ctx.fillStyle = '#c4c4d0'
    ctx.fill()
    ctx.restore()
  } else {
    ctx.strokeStyle = hover ? 'rgba(200,200,220,0.45)' : 'rgba(200,200,220,0.18)'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }
}

function drawPins(
  ctx: CanvasRenderingContext2D,
  node: FlowNode,
  t: FlowTheme,
  conns: Set<string>,
  hPin: HoverPin | null,
  draftInfo: DraftPinInfo | null,
  ptr?: PinTypeRegistry | null,
) {
  const x = node.position.x
  const y = node.position.y
  const w = node.width ?? NODE_W

  const draw = (pin: FlowPin, idx: number, isOut: boolean) => {
    const py = y + PIN_Y0 + idx * SLOT_H + SLOT_H * 0.5
    const px = isOut ? x + w : x
    const color = pColor(pin.type, t, ptr)
    const filled = conns.has(`${node.id}:${pin.id}:${isOut ? 'o' : 'i'}`)
    const hover = hPin != null && hPin.pinId === pin.id && hPin.isOutput === isOut

    let alpha = 1.0
    let compatible = false
    if (draftInfo) {
      if (node.id === draftInfo.sourceNodeId) {
        alpha = 0.15
      } else if (isPinCompatible(pin.type, isOut, draftInfo)) {
        alpha = 1.0
        compatible = true
      } else {
        alpha = 0.15
      }
    }

    ctx.save()
    ctx.globalAlpha = alpha

    if (compatible && !hover) {
      ctx.save()
      ctx.shadowColor = pin.type === 'exec' ? 'rgba(200,200,220,0.4)' : color
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(px, py, PIN_R + 2, 0, Math.PI * 2)
      ctx.fillStyle = pin.type === 'exec' ? 'rgba(200,200,220,0.06)' : rgba(color, 0.06)
      ctx.fill()
      ctx.restore()
    }

    if (pin.type === 'exec') {
      drawExecPin(ctx, px, py, filled, hover)
    } else {
      drawDataPin(ctx, px, py, color, filled, hover)
    }

    if (pin.label) {
      ctx.fillStyle = rgba(color, hover ? 0.75 : filled ? 0.58 : 0.42)
      ctx.font = `400 11px ${FONT}`
      ctx.textAlign = isOut ? 'right' : 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(pin.label, isOut ? px - 15 : px + 15, py)
    }

    ctx.restore()
  }

  node.inputs.forEach((p, i) => draw(p, i, false))
  node.outputs.forEach((p, i) => draw(p, i, true))
}

/* -- node -- */

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: FlowNode,
  t: FlowTheme,
  conns: Set<string>,
  selected: boolean,
  hovered: boolean,
  hPin: HoverPin | null,
  draftInfo: DraftPinInfo | null,
  ptr?: PinTypeRegistry | null,
) {
  if (node.type === GROUP_NODE_TYPE) return

  const x = node.position.x
  const y = node.position.y
  const w = node.width ?? NODE_W
  const h = nodeHeight(node)
  const accent = node.color ?? '#6366f1'
  const sel = t.selection!.color!

  // Shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 22
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 5
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.fillStyle = t.node!.body!
  ctx.fill()
  ctx.restore()

  // Body (clipped)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()

  ctx.fillStyle = t.node!.body!
  ctx.fillRect(x, y, w, h)

  ctx.fillStyle = accent
  ctx.fillRect(x, y, w, 2)

  ctx.fillStyle = rgba(accent, 0.03)
  ctx.fillRect(x, y, w, TITLE_H)

  if (hovered && !selected) {
    const grad = ctx.createLinearGradient(x, y, x, y + h * 0.3)
    grad.addColorStop(0, 'rgba(255,255,255,0.012)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(x, y, w, h * 0.3)
  }

  ctx.restore()

  // Inset separator
  ctx.beginPath()
  ctx.moveTo(x + 14, y + TITLE_H)
  ctx.lineTo(x + w - 14, y + TITLE_H)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  ctx.stroke()

  // Border
  ctx.beginPath()
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, CORNER)
  if (selected) {
    ctx.strokeStyle = rgba(sel, 0.4)
    ctx.lineWidth = 1.5
  } else if (hovered) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 0.75
  } else {
    ctx.strokeStyle = t.node!.border!
    ctx.lineWidth = 0.5
  }
  ctx.stroke()

  if (selected) {
    ctx.save()
    ctx.shadowColor = rgba(sel, 0.08)
    ctx.shadowBlur = 16
    ctx.beginPath()
    ctx.roundRect(x - 1, y - 1, w + 2, h + 2, CORNER + 1)
    ctx.strokeStyle = rgba(sel, 0.12)
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }

  // Title accent dot
  ctx.beginPath()
  ctx.arc(x + 16, y + TITLE_H * 0.5, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = accent
  ctx.fill()

  // Title text
  ctx.fillStyle = t.node!.text!
  ctx.font = `600 12px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(node.label, x + 28, y + TITLE_H * 0.5)

  // Category badge
  const badgeText = badge(node)
  if (badgeText) {
    ctx.font = `600 8px ${FONT}`
    const tw = ctx.measureText(badgeText).width
    const bw = tw + 10
    const bh = 16
    const bx = x + w - bw - 10
    const by = y + (TITLE_H - bh) * 0.5

    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, 4)
    ctx.fillStyle = rgba(accent, 0.1)
    ctx.fill()

    ctx.fillStyle = rgba(accent, 0.65)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(badgeText, bx + bw * 0.5, by + bh * 0.5)
  }

  drawPins(ctx, node, t, conns, hPin, draftInfo, ptr)
}

/* -- connections (with waypoints + animation) -- */

function drawBezierChain(ctx: CanvasRenderingContext2D, fp: V2, tp: V2, waypoints?: FlowWaypoint[]) {
  const pts: V2[] = [fp, ...(waypoints ?? []), tp]
  ctx.beginPath()
  ctx.moveTo(fp.x, fp.y)
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const dx = Math.abs(b.x - a.x)
    const off = Math.max(dx * 0.5, BEZIER_MIN_OFFSET)
    ctx.bezierCurveTo(a.x + off, a.y, b.x - off, b.y, b.x, b.y)
  }
}

function drawConnections(
  ctx: CanvasRenderingContext2D,
  nodes: FlowNode[],
  connections: FlowConnection[],
  nodeMap: Map<string, FlowNode>,
  t: FlowTheme,
  execDashOffset: number | null,
  ptr?: PinTypeRegistry | null,
) {
  const lw = t.connection!.width as number

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineWidth = lw

  for (const conn of connections) {
    const fn = nodeMap.get(conn.fromNodeId)
    const tn = nodeMap.get(conn.toNodeId)
    if (!fn || !tn) continue

    const fp = pinXY(fn, conn.fromPinId, true)
    const tp = pinXY(tn, conn.toPinId, false)
    if (!fp || !tp) continue

    const fromPin = fn.outputs.find(p => p.id === conn.fromPinId)
    const toPin = tn.inputs.find(p => p.id === conn.toPinId)
    const fc = pColor(fromPin?.type ?? 'exec', t, ptr)
    const tc = pColor(toPin?.type ?? 'exec', t, ptr)
    const isExec = fromPin?.type === 'exec'

    // Animated dashes for exec connections
    if (isExec && execDashOffset != null) {
      ctx.setLineDash([8, 6])
      ctx.lineDashOffset = -execDashOffset
    } else {
      ctx.setLineDash([])
      ctx.lineDashOffset = 0
    }

    const grad = ctx.createLinearGradient(fp.x, 0, tp.x, 0)
    grad.addColorStop(0, rgba(fc, 0.5))
    grad.addColorStop(1, rgba(tc, 0.38))

    drawBezierChain(ctx, fp, tp, conn.waypoints)
    ctx.strokeStyle = grad
    ctx.stroke()
  }

  ctx.setLineDash([])
  ctx.restore()
}

/* -- waypoint handles -- */

function drawWaypointHandles(
  ctx: CanvasRenderingContext2D,
  connections: FlowConnection[],
  nodes: FlowNode[],
  t: FlowTheme,
  selectedWpId: string | null,
  ptr?: PinTypeRegistry | null,
) {
  for (const conn of connections) {
    if (!conn.waypoints || conn.waypoints.length === 0) continue
    const fn = nodes.find(n => n.id === conn.fromNodeId)
    if (!fn) continue
    const fromPin = fn.outputs.find(p => p.id === conn.fromPinId)
    const color = pColor(fromPin?.type ?? 'exec', t, ptr)

    for (const wp of conn.waypoints) {
      const isSel = wp.id === selectedWpId

      ctx.beginPath()
      ctx.arc(wp.x, wp.y, isSel ? 6 : 4.5, 0, Math.PI * 2)
      ctx.fillStyle = isSel ? color : t.node!.body!
      ctx.fill()
      ctx.strokeStyle = rgba(color, isSel ? 0.8 : 0.5)
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }
}

/* -- draft connection -- */

function drawDraft(ctx: CanvasRenderingContext2D, draft: DraftConnection, _t: FlowTheme) {
  ctx.save()
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.setLineDash([6, 5])
  ctx.globalAlpha = 0.3

  const f = draft.fromPos
  const to = draft.toPos
  const dx = Math.abs(to.x - f.x)
  const off = Math.max(dx * 0.5, 60)

  ctx.beginPath()
  if (draft.isFromOutput) {
    ctx.moveTo(f.x, f.y)
    ctx.bezierCurveTo(f.x + off, f.y, to.x - off, to.y, to.x, to.y)
  } else {
    ctx.moveTo(f.x, f.y)
    ctx.bezierCurveTo(f.x - off, f.y, to.x + off, to.y, to.x, to.y)
  }
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  ctx.setLineDash([])
  ctx.globalAlpha = 0.25
  ctx.beginPath()
  ctx.arc(to.x, to.y, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  ctx.restore()
}

/* -- rubber band -- */

function drawRubberBand(ctx: CanvasRenderingContext2D, rect: Rect, t: FlowTheme) {
  const c = t.selection!.color!.startsWith('#') ? t.selection!.color! : '#3b82f6'
  ctx.save()
  ctx.fillStyle = rgba(c, 0.04)
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.strokeStyle = rgba(c, 0.18)
  ctx.lineWidth = 1
  ctx.setLineDash([5, 4])
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  ctx.restore()
}

/* -- alignment guides -- */

function drawAlignmentGuides(ctx: CanvasRenderingContext2D, guides: AlignmentGuide[], zoom: number) {
  if (guides.length === 0) return
  ctx.save()
  ctx.strokeStyle = '#a78bfa'
  ctx.lineWidth = 1 / zoom
  ctx.setLineDash([4 / zoom, 3 / zoom])
  ctx.globalAlpha = 0.6

  for (const g of guides) {
    ctx.beginPath()
    if (g.orientation === 'vertical') {
      ctx.moveTo(g.worldCoord, g.start)
      ctx.lineTo(g.worldCoord, g.end)
    } else {
      ctx.moveTo(g.start, g.worldCoord)
      ctx.lineTo(g.end, g.worldCoord)
    }
    ctx.stroke()
  }

  ctx.restore()
}

/* -- component -- */

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  store,
  theme: customTheme,
  readOnly,
  snapToGrid,
  onSelectionChange,
  onFitView,
  onContextMenu,
  showMinimap,
  snapToAlignment,
  alignThreshold,
  onExportImage,
  animateConnections,
  onGroup,
  searchPalette,
  pinTypes: pinTypesRegistry,
  width = '100%',
  height = '600px',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useMemo(() => buildTheme(customTheme), [customTheme])
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [paletteOpen, setPaletteOpen] = useState(false)
  const animPhaseRef = useRef(0)
  const animateRef = useRef(animateConnections ?? false)
  animateRef.current = animateConnections ?? false

  const interaction = useCanvasInteraction(store, {
    readOnly,
    snapToGrid,
    onSelectionChange,
    onContextMenu,
    snapToAlignment,
    alignThreshold,
    onGroup,
    onSearchPalette: searchPalette ? () => setPaletteOpen(true) : undefined,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const detach = interaction.attach(canvas)
    const dpr = window.devicePixelRatio || 1

    // Expose fitView
    if (onFitView) {
      onFitView(() => {
        const rect = canvas.getBoundingClientRect()
        interaction.viewport.fitView(store.getNodes(), rect.width, rect.height)
        interaction.needsRedraw.current = true
      })
    }

    // Expose export image
    if (onExportImage) {
      onExportImage((options = {}) => {
        const { padding = 40, scale = 2, background } = options
        const nodes = store.getNodes()
        if (nodes.length === 0) return ''

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const n of nodes) {
          if (n.type === GROUP_NODE_TYPE) {
            const gw = (n.data.groupWidth as number) ?? 300
            const gh = (n.data.groupHeight as number) ?? 200
            if (n.position.x < minX) minX = n.position.x
            if (n.position.y < minY) minY = n.position.y
            if (n.position.x + gw > maxX) maxX = n.position.x + gw
            if (n.position.y + gh > maxY) maxY = n.position.y + gh
          } else {
            const w = n.width ?? NODE_W
            const h = nodeHeight(n)
            if (n.position.x < minX) minX = n.position.x
            if (n.position.y < minY) minY = n.position.y
            if (n.position.x + w > maxX) maxX = n.position.x + w
            if (n.position.y + h > maxY) maxY = n.position.y + h
          }
        }

        const worldW = maxX - minX + padding * 2
        const worldH = maxY - minY + padding * 2
        const offCanvas = document.createElement('canvas')
        offCanvas.width = worldW * scale
        offCanvas.height = worldH * scale
        const offCtx = offCanvas.getContext('2d')!
        offCtx.setTransform(scale, 0, 0, scale, 0, 0)

        // Background
        offCtx.fillStyle = background ?? theme.canvas!.background!
        offCtx.fillRect(0, 0, worldW, worldH)

        // Offset to center content
        offCtx.save()
        offCtx.translate(-(minX - padding), -(minY - padding))

        // Draw groups
        drawGroups(offCtx, nodes, theme, new Set())
        // Draw connections
        const connections = store.getConnections()
        const nodeMap = new Map(nodes.map(n => [n.id, n]))
        drawConnections(offCtx, nodes, connections, nodeMap, theme, null, pinTypesRegistry)
        // Draw waypoint handles
        drawWaypointHandles(offCtx, connections, nodes, theme, null, pinTypesRegistry)
        // Draw nodes
        const conns = connectedSet(connections)
        for (const node of nodes) {
          drawNode(offCtx, node, theme, conns, false, false, null, null, pinTypesRegistry)
        }

        offCtx.restore()
        return offCanvas.toDataURL('image/png')
      })
    }

    let rafId: number

    const paint = () => {
      // Animation: always repaint when active
      const isAnimating = animateRef.current
      if (!interaction.needsRedraw.current && !isAnimating) {
        rafId = requestAnimationFrame(paint)
        return
      }
      interaction.needsRedraw.current = false

      // Advance animation phase
      if (isAnimating) {
        animPhaseRef.current = (animPhaseRef.current + 0.8) % 28
      }

      const rect = canvas.getBoundingClientRect()
      const cw = rect.width
      const ch = rect.height
      const targetW = cw * dpr
      const targetH = ch * dpr

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
      }

      if (cw !== canvasSize.width || ch !== canvasSize.height) {
        setCanvasSize({ width: cw, height: ch })
      }

      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const { offset, zoom } = interaction.viewport.ref.current
      drawGrid(ctx, cw, ch, theme, offset.x, offset.y, zoom)

      ctx.save()
      ctx.translate(offset.x, offset.y)
      ctx.scale(zoom, zoom)

      const nodes = store.getNodes()
      const connections = store.getConnections()
      const nodeMap = new Map(nodes.map(n => [n.id, n]))
      const conns = connectedSet(connections)
      const sel = interaction.selectedRef.current
      const hovNodeId = interaction.hoveredNodeRef.current
      const hovPin = interaction.hoveredPinRef.current
      const selectedWpId = interaction.selectedWaypointRef.current

      // Groups (behind everything)
      drawGroups(ctx, nodes, theme, sel)

      // Connections (with animation + waypoints)
      drawConnections(ctx, nodes, connections, nodeMap, theme, isAnimating ? animPhaseRef.current : null, pinTypesRegistry)

      // Waypoint handles
      drawWaypointHandles(ctx, connections, nodes, theme, selectedWpId, pinTypesRegistry)

      // Nodes
      const draft = interaction.draftRef.current
      const draftInfo = draft ? resolveDraftInfo(draft, nodes) : null

      for (const node of nodes) {
        const isHov = hovNodeId === node.id
        drawNode(ctx, node, theme, conns, sel.has(node.id), isHov, isHov ? hovPin : null, draftInfo, pinTypesRegistry)
      }

      if (draft) drawDraft(ctx, draft, theme)

      const guides = interaction.alignmentGuidesRef.current
      if (guides.length > 0) drawAlignmentGuides(ctx, guides, zoom)

      const rb = interaction.rubberBandRef.current
      if (rb) drawRubberBand(ctx, rb, theme)

      ctx.restore()

      rafId = requestAnimationFrame(paint)
    }

    interaction.needsRedraw.current = true
    rafId = requestAnimationFrame(paint)

    const obs = new ResizeObserver(() => { interaction.needsRedraw.current = true })
    obs.observe(canvas)

    const dirty = () => { interaction.needsRedraw.current = true }
    const unsubs = [
      store.events.on('graph:imported', dirty),
      store.events.on('node:added', dirty),
      store.events.on('node:removed', dirty),
      store.events.on('node:moved', dirty),
      store.events.on('node:dataChanged', dirty),
      store.events.on('connection:added', dirty),
      store.events.on('connection:removed', dirty),
      store.events.on('connection:updated', dirty),
      store.events.on('batch:end', dirty),
    ]

    return () => {
      cancelAnimationFrame(rafId)
      obs.disconnect()
      detach()
      unsubs.forEach(u => u())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, customTheme, readOnly, snapToGrid])

  const canvasStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    display: 'block',
    outline: 'none',
    touchAction: 'none',
  }

  const getViewportCenter = () => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return interaction.viewport.screenToWorld(rect.width / 2, rect.height / 2)
  }

  // Always use wrapper div now (search palette / minimap need it)
  return (
    <div style={{ position: 'relative', width: canvasStyle.width, height: canvasStyle.height }}>
      <canvas ref={canvasRef} style={{ ...canvasStyle, width: '100%', height: '100%' }} />
      {showMinimap && (
        <Minimap
          store={store}
          viewport={interaction.viewport}
          needsRedraw={interaction.needsRedraw}
          canvasSize={canvasSize}
          theme={theme}
          style={{ position: 'absolute', bottom: 12, right: 12 }}
        />
      )}
      {searchPalette && (
        <SearchPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          items={searchPalette.items}
          onSelect={(item, worldPos) => {
            searchPalette.onSelect(item, worldPos)
            setPaletteOpen(false)
          }}
          viewportCenter={getViewportCenter()}
        />
      )}
    </div>
  )
}
