import type { FlowNode } from '../types'

const TITLE_H = 30
const SLOT_H = 22
const PIN_Y0 = TITLE_H + 10
const NODE_W = 220
const HIT_RADIUS = 10

interface Vec2 { x: number; y: number }

export interface PinHit {
  nodeId: string
  pinId: string
  isOutput: boolean
  pos: Vec2
}

export function nodeHeight(node: FlowNode): number {
  const rows = Math.max(node.inputs.length, node.outputs.length)
  return rows === 0 ? TITLE_H + 14 : PIN_Y0 + rows * SLOT_H + 8
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
