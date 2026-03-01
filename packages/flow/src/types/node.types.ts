import type { FlowPin } from './pin.types'

export interface FlowNodePosition {
  x: number
  y: number
}

export interface FlowNode {
  id: string
  type: string // namespaced: 'fivem/event', 'minecraft/command'
  label: string
  position: FlowNodePosition
  inputs: FlowPin[]
  outputs: FlowPin[]
  data: Record<string, unknown>
  width?: number
  color?: string
}
