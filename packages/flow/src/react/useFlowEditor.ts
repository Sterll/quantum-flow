import { useMemo, useCallback, useEffect, useRef } from 'react'
import type { FlowNode, FlowConnection, FlowGraph, FlowNodePosition } from '../types'
import type { Validator } from '../model/Validator'
import type { NodeDefinitionWithFactory } from '../define/defineNode'
import { NodeRegistry } from '../define/NodeRegistry'
import { useGraphStore } from './useGraphStore'
import { useHistory, type UseHistoryAPI } from './useHistory'
import { useClipboard } from './useClipboard'
import type { GraphStore } from '../model/GraphStore'
import type { FlowPlugin } from '../plugin/types'
import type { PinTypeRegistry } from '../plugin/PinTypeRegistry'
import { createFlowEditor } from '../plugin/createFlowEditor'

export interface UseFlowEditorOptions {
  initialGraph?: FlowGraph
  validator?: Validator
  history?: boolean | { maxSize?: number }
  registry?: NodeDefinitionWithFactory[]
  plugins?: Array<FlowPlugin | (() => FlowPlugin)>
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

  moveNode(nodeId: string, position: FlowNodePosition): void
  updateNodeData(nodeId: string, data: Record<string, unknown>): void
  batch(fn: () => void): void
  clear(): void
  getNode(id: string): FlowNode | undefined
  getNodes(): FlowNode[]
  getConnections(): FlowConnection[]
  getConnectionsForNode(nodeId: string): FlowConnection[]

  copy(nodeIds: Set<string> | string[]): void
  cut(nodeIds: Set<string> | string[]): void
  paste(offset?: { x: number; y: number }): FlowNode[]
  canPaste: boolean

  toJSON(): FlowGraph
  fromJSON(graph: FlowGraph): void

  registry: NodeRegistry | null
  pinTypes: PinTypeRegistry | null
}

const noopHistory: Pick<UseHistoryAPI, 'undo' | 'redo' | 'canUndo' | 'canRedo'> = {
  undo: () => false,
  redo: () => false,
  canUndo: false,
  canRedo: false,
}

export function useFlowEditor(options?: UseFlowEditorOptions): FlowEditorAPI {
  const hasPlugins = options?.plugins && options.plugins.length > 0

  // Plugin path: use createFlowEditor for full plugin pipeline
  const editorInstance = useMemo(() => {
    if (!hasPlugins) return null
    return createFlowEditor({
      plugins: options!.plugins,
      initialGraph: options?.initialGraph,
      validator: options?.validator,
      history: options?.history,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup plugin dispose on unmount
  const disposeRef = useRef<(() => void) | null>(null)
  if (editorInstance) {
    disposeRef.current = editorInstance.dispose
  }
  useEffect(() => {
    return () => { disposeRef.current?.() }
  }, [])

  // Non-plugin path: use the classic hooks-based approach
  const historyEnabled = options?.history !== false

  const historyOptions = historyEnabled
    ? (typeof options?.history === 'object' ? options.history : undefined)
    : { maxSize: 1 }

  const classicStore = useGraphStore({
    initialGraph: hasPlugins ? undefined : options?.initialGraph,
    validator: hasPlugins ? undefined : options?.validator,
  })

  const store = editorInstance?.store ?? classicStore

  // Always call useHistory to respect Rules of Hooks (no conditional hook calls).
  // When using plugins, the editorInstance already has its own HistoryManager,
  // so we pass maxSize: 1 to minimize overhead for the unused hook instance.
  const historyApi = useHistory(store, hasPlugins ? { maxSize: 1 } : historyOptions)
  const effectiveHistory = hasPlugins
    ? (editorInstance!.history
        ? { undo: () => editorInstance!.history!.undo(), redo: () => editorInstance!.history!.redo(), canUndo: editorInstance!.history!.canUndo(), canRedo: editorInstance!.history!.canRedo() }
        : noopHistory)
    : (historyEnabled ? historyApi : noopHistory)

  const registry = useMemo(() => {
    if (hasPlugins) return editorInstance!.registry
    if (!options?.registry || options.registry.length === 0) return null
    const reg = new NodeRegistry()
    reg.registerMany(options.registry)
    return reg
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pinTypes = editorInstance?.pinTypes ?? null

  const addNode = useCallback((node: FlowNode) => store.addNode(node), [store])
  const removeNode = useCallback((nodeId: string) => store.removeNode(nodeId), [store])
  const addConnection = useCallback((conn: FlowConnection) => store.addConnection(conn), [store])
  const removeConnection = useCallback((connId: string) => store.removeConnection(connId), [store])
  const moveNode = useCallback((nodeId: string, position: FlowNodePosition) => store.moveNode(nodeId, position), [store])
  const updateNodeData = useCallback((nodeId: string, data: Record<string, unknown>) => store.updateNodeData(nodeId, data), [store])
  const batch = useCallback((fn: () => void) => store.batch(fn), [store])
  const clear = useCallback(() => store.clear(), [store])
  const getNode = useCallback((id: string) => store.getNode(id), [store])
  const getNodes = useCallback(() => store.getNodes(), [store])
  const getConnections = useCallback(() => store.getConnections(), [store])
  const getConnectionsForNode = useCallback((nodeId: string) => store.getConnectionsForNode(nodeId), [store])
  const clipboard = useClipboard(store)

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
    moveNode,
    updateNodeData,
    batch,
    clear,
    getNode,
    getNodes,
    getConnections,
    getConnectionsForNode,
    copy: clipboard.copy,
    cut: clipboard.cut,
    paste: clipboard.paste,
    canPaste: clipboard.canPaste,
    toJSON,
    fromJSON,
    registry,
    pinTypes,
  }
}
