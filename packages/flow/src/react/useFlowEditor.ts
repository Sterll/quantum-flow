import { useMemo, useCallback } from 'react'
import type { FlowNode, FlowConnection, FlowGraph } from '../types'
import type { Validator } from '../model/Validator'
import type { NodeDefinitionWithFactory } from '../define/defineNode'
import { NodeRegistry } from '../define/NodeRegistry'
import { useGraphStore } from './useGraphStore'
import { useHistory, type UseHistoryAPI } from './useHistory'
import type { GraphStore } from '../model/GraphStore'

export interface UseFlowEditorOptions {
  initialGraph?: FlowGraph
  validator?: Validator
  history?: boolean | { maxSize?: number }
  registry?: NodeDefinitionWithFactory[]
}

export interface FlowEditorAPI {
  store: GraphStore

  undo(): boolean
  redo(): boolean
  canUndo: boolean
  canRedo: boolean

  addNode(node: FlowNode): void
  removeNode(nodeId: string): void
  addConnection(connection: FlowConnection): void
  removeConnection(connectionId: string): void

  toJSON(): FlowGraph
  fromJSON(graph: FlowGraph): void

  registry: NodeRegistry | null
}

const noopHistory: UseHistoryAPI = {
  undo: () => false,
  redo: () => false,
  canUndo: false,
  canRedo: false,
  history: null as any,
}

export function useFlowEditor(options?: UseFlowEditorOptions): FlowEditorAPI {
  const historyEnabled = options?.history !== false
  const historyOptions = typeof options?.history === 'object' ? options.history : undefined

  const store = useGraphStore({
    initialGraph: options?.initialGraph,
    validator: options?.validator,
  })

  // Always call useHistory to respect Rules of Hooks (no conditional hook calls).
  // When history is disabled, we ignore its output and use noopHistory instead.
  const historyApi = useHistory(store, historyOptions)
  const effectiveHistory = historyEnabled ? historyApi : noopHistory

  const registry = useMemo(() => {
    if (!options?.registry || options.registry.length === 0) return null
    const reg = new NodeRegistry()
    reg.registerMany(options.registry)
    return reg
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addNode = useCallback((node: FlowNode) => store.addNode(node), [store])
  const removeNode = useCallback((nodeId: string) => store.removeNode(nodeId), [store])
  const addConnection = useCallback((conn: FlowConnection) => store.addConnection(conn), [store])
  const removeConnection = useCallback((connId: string) => store.removeConnection(connId), [store])
  const toJSON = useCallback(() => store.getState(), [store])
  const fromJSON = useCallback((graph: FlowGraph) => store.importGraph(graph), [store])

  return {
    store,
    undo: effectiveHistory.undo,
    redo: effectiveHistory.redo,
    canUndo: effectiveHistory.canUndo,
    canRedo: effectiveHistory.canRedo,
    addNode,
    removeNode,
    addConnection,
    removeConnection,
    toJSON,
    fromJSON,
    registry,
  }
}
