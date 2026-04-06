import type { FlowGraph } from '../types'
import type { ValidationRule } from '../model/Validator'
import { Validator } from '../model/Validator'
import { GraphStore } from '../model/GraphStore'
import { NodeRegistry } from '../define/NodeRegistry'
import { HistoryManager } from '../model/HistoryManager'
import { PinTypeRegistry } from './PinTypeRegistry'
import type { FlowPlugin } from './types'

export interface FlowEditorOptions {
  plugins?: Array<FlowPlugin | (() => FlowPlugin)>
  initialGraph?: FlowGraph
  validator?: Validator | ValidationRule[]
  history?: boolean | { maxSize?: number }
}

export interface FlowEditorInstance {
  store: GraphStore
  registry: NodeRegistry
  validator: Validator
  history: HistoryManager | null
  pinTypes: PinTypeRegistry
  dispose(): void
}

function resolvePlugin(pluginOrFactory: FlowPlugin | (() => FlowPlugin)): FlowPlugin {
  return typeof pluginOrFactory === 'function' ? pluginOrFactory() : pluginOrFactory
}

export function createFlowEditor(options?: FlowEditorOptions): FlowEditorInstance {
  // 1. Create Validator
  let validator: Validator
  if (options?.validator instanceof Validator) {
    validator = options.validator
  } else if (Array.isArray(options?.validator)) {
    validator = new Validator(options.validator)
  } else {
    validator = new Validator()
  }

  // 2. Create GraphStore with the validator
  const store = new GraphStore({ validator })

  // 3. Create NodeRegistry
  const registry = new NodeRegistry()

  // 4. Create PinTypeRegistry with built-in defaults
  const pinTypes = new PinTypeRegistry()

  // 5. Apply plugins
  const cleanups: Array<() => void> = []
  const plugins = options?.plugins ?? []

  for (const pluginOrFactory of plugins) {
    const plugin = resolvePlugin(pluginOrFactory)

    // Register nodes
    if (plugin.nodes && plugin.nodes.length > 0) {
      registry.registerMany(plugin.nodes)
    }

    // Register pin types
    if (plugin.pinTypes) {
      for (const [type, info] of Object.entries(plugin.pinTypes)) {
        pinTypes.register(type, info)
      }
    }

    // Add validation rules
    if (plugin.rules) {
      const rules = typeof plugin.rules === 'function'
        ? plugin.rules(Validator)
        : plugin.rules
      for (const rule of rules) {
        validator.addRule(rule)
      }
    }

    // Call setup
    if (plugin.setup) {
      const cleanup = plugin.setup({ store, registry, validator, pinTypes })
      if (typeof cleanup === 'function') {
        cleanups.push(cleanup)
      }
    }
  }

  // 6. Create HistoryManager if enabled
  const historyEnabled = options?.history !== false
  let history: HistoryManager | null = null
  if (historyEnabled) {
    const historyOpts = typeof options?.history === 'object' ? options.history : undefined
    history = new HistoryManager(store, historyOpts)
  }

  // 7. Import initial graph
  if (options?.initialGraph) {
    store.importGraph(options.initialGraph)
  }

  // 8. Dispose function
  const dispose = () => {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }

  return { store, registry, validator, history, pinTypes, dispose }
}
