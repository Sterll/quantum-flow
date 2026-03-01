import type { FlowNode, FlowPin, FlowNodePosition } from '../types'

export interface NodeDefinition {
  type: string
  label: string
  color?: string
  icon?: string
  inputs: FlowPin[]
  outputs: FlowPin[]
  defaultData?: Record<string, unknown>
}

export interface NodeDefinitionWithFactory extends NodeDefinition {
  createInstance: (position: FlowNodePosition, overrides?: Partial<FlowNode>) => FlowNode
}

let _idCounter = 0
function generateId(): string {
  return `node-${Date.now()}-${++_idCounter}`
}

export function defineNode(definition: NodeDefinition): NodeDefinitionWithFactory {
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
