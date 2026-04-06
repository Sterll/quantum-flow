import type { FlowNode, FlowConnection, FlowWaypoint } from '../types'
import { NODE_W, TITLE_H, SLOT_H, PIN_Y0, HIT_RADIUS, WAYPOINT_R, GROUP_HEADER_H, BEZIER_MIN_OFFSET } from '../constants'

export const GROUP_NODE_TYPE = '__group'
export { GROUP_HEADER_H }

interface Vec2 { x: number; y: number }

export interface PinHit {
  nodeId: string
  pinId: string
  isOutput: boolean
  pos: Vec2
}

export interface GroupHit {
  nodeId: string
  isHeader: boolean
}

export interface WaypointHit {
  connectionId: string
  waypointId: string
  pos: Vec2
}

export function nodeHeight(node: FlowNode): number {
  const rows = Math.max(node.inputs.length, node.outputs.length)
  return rows === 0 ? TITLE_H + 14 : PIN_Y0 + rows * SLOT_H + 10
}

export function hitTestPin(worldPos: Vec2, nodes: FlowNode[]): PinHit | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    const w = node.width ?? NODE_W

    for (let j = 0; j < node.outputs.length; j++) {
      const px = node.position.x + w
      const py = node.position.y + PIN_Y0 + j * SLOT_H + SLOT_H * 0.5
      const dx = worldPos.x - px
      const dy = worldPos.y - py
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) {
        return { nodeId: node.id, pinId: node.outputs[j].id, isOutput: true, pos: { x: px, y: py } }
      }
    }

    for (let j = 0; j < node.inputs.length; j++) {
      const px = node.position.x
      const py = node.position.y + PIN_Y0 + j * SLOT_H + SLOT_H * 0.5
      const dx = worldPos.x - px
      const dy = worldPos.y - py
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) {
        return { nodeId: node.id, pinId: node.inputs[j].id, isOutput: false, pos: { x: px, y: py } }
      }
    }
  }
  return null
}

export function hitTestNode(worldPos: Vec2, nodes: FlowNode[]): FlowNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (node.type === GROUP_NODE_TYPE) continue
    const w = node.width ?? NODE_W
    const h = nodeHeight(node)
    if (
      worldPos.x >= node.position.x &&
      worldPos.x <= node.position.x + w &&
      worldPos.y >= node.position.y &&
      worldPos.y <= node.position.y + h
    ) {
      return node
    }
  }
  return null
}

export function hitTestGroup(worldPos: Vec2, nodes: FlowNode[]): GroupHit | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (node.type !== GROUP_NODE_TYPE) continue
    const gw = (node.data.groupWidth as number) ?? 300
    const gh = (node.data.groupHeight as number) ?? 200
    const x = node.position.x
    const y = node.position.y
    if (worldPos.x >= x && worldPos.x <= x + gw && worldPos.y >= y && worldPos.y <= y + gh) {
      return { nodeId: node.id, isHeader: worldPos.y <= y + GROUP_HEADER_H }
    }
  }
  return null
}

export function hitTestWaypoint(worldPos: Vec2, connections: FlowConnection[]): WaypointHit | null {
  for (const conn of connections) {
    if (!conn.waypoints) continue
    for (const wp of conn.waypoints) {
      const dx = worldPos.x - wp.x
      const dy = worldPos.y - wp.y
      if (dx * dx + dy * dy <= WAYPOINT_R * WAYPOINT_R) {
        return { connectionId: conn.id, waypointId: wp.id, pos: { x: wp.x, y: wp.y } }
      }
    }
  }
  return null
}

function sampleBezier(p0: Vec2, cp1: Vec2, cp2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * cp1.x + 3 * u * t * t * cp2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * cp1.y + 3 * u * t * t * cp2.y + t * t * t * p3.y,
  }
}

function pointToSegDist(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x, aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby))
}

export function hitTestConnectionSegment(
  worldPos: Vec2,
  fp: Vec2,
  tp: Vec2,
  waypoints?: FlowWaypoint[],
  threshold = 8,
): boolean {
  const pts: Vec2[] = [fp, ...(waypoints ?? []), tp]
  const SAMPLES = 20
  for (let s = 0; s < pts.length - 1; s++) {
    const a = pts[s]
    const b = pts[s + 1]
    const dx = Math.abs(b.x - a.x)
    const off = Math.max(dx * 0.5, BEZIER_MIN_OFFSET)
    const cp1 = { x: a.x + off, y: a.y }
    const cp2 = { x: b.x - off, y: b.y }
    let prev = a
    for (let i = 1; i <= SAMPLES; i++) {
      const cur = sampleBezier(a, cp1, cp2, b, i / SAMPLES)
      if (pointToSegDist(worldPos, prev, cur) <= threshold) return true
      prev = cur
    }
  }
  return false
}
