import type { GraphStore } from '../model/GraphStore'
import type { NodeRegistry } from '../define/NodeRegistry'
import type { Validator, ValidationRule } from '../model/Validator'
import type { NodeDefinitionWithFactory } from '../define/defineNode'
import type { PinTypeRegistry } from './PinTypeRegistry'

export interface FlowPluginContext {
  store: GraphStore
  registry: NodeRegistry
  validator: Validator
  pinTypes: PinTypeRegistry
}

export interface FlowPlugin {
  name: string
  version?: string
  /** Nodes to auto-register in the NodeRegistry */
  nodes?: NodeDefinitionWithFactory[]
  /** Custom pin types with color and optional label */
  pinTypes?: Record<string, { color: string; label?: string }>
  /** Validation rules to add to the Validator */
  rules?: ValidationRule[] | ((ValidatorClass: typeof Validator) => ValidationRule[])
  /** Lifecycle hook called after initialization with full context. Return a cleanup function. */
  setup?: (ctx: FlowPluginContext) => void | (() => void)
}
