import type { ComponentType } from 'react'
import type { FlowNode, FlowPin, FlowNodePosition } from '../types'

export interface NodeOverlayProps {
  nodeId: string
  data: Record<string, unknown>
  updateData: (patch: Record<string, unknown>) => void
  width: number
  height: number
  selected: boolean
}

export interface NodeDefinition {
  type: string
  label: string
  color?: string
  icon?: string
  category?: string
  inputs: FlowPin[]
  outputs: FlowPin[]
  defaultData?: Record<string, unknown>
  component?: ComponentType<NodeOverlayProps>
}

export interface NodeDefinitionWithFactory extends NodeDefinition {
  createInstance: (position: FlowNodePosition, overrides?: Partial<FlowNode>) => FlowNode
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function validatePins(pins: FlowPin[], label: string): void {
  const seen = new Set<string>()
  for (const pin of pins) {
    if (seen.has(pin.id)) {
      throw new Error(`Duplicate pin ID '${pin.id}' in ${label}`)
    }
    seen.add(pin.id)
  }
}

export function defineNode(definition: NodeDefinition): NodeDefinitionWithFactory {
  validatePins(definition.inputs, `${definition.type} inputs`)
  validatePins(definition.outputs, `${definition.type} outputs`)

  return {
    ...definition,
    createInstance(position: FlowNodePosition, overrides?: Partial<FlowNode>): FlowNode {
      return {
        id: generateId(),
        type: definition.type,
        label: definition.label,
        position,
        inputs: definition.inputs.map(p => ({ ...p })),
        outputs: definition.outputs.map(p => ({ ...p })),
        data: { ...definition.defaultData },
        color: definition.color,
        ...overrides,
      }
    },
  }
}
