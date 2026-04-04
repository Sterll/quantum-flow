import { useCallback, useRef, useState } from 'react'
import type { GraphStore } from '../model/GraphStore'
import type { FlowNode, FlowConnection } from '../types'

interface ClipboardBuffer {
  nodes: FlowNode[]
  connections: FlowConnection[]
}

export interface UseClipboardAPI {
  copy(nodeIds: Set<string> | string[]): void
  cut(nodeIds: Set<string> | string[]): void
  paste(offset?: { x: number; y: number }): FlowNode[]
  canPaste: boolean
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useClipboard(store: GraphStore): UseClipboardAPI {
  const bufferRef = useRef<ClipboardBuffer | null>(null)
  const [canPaste, setCanPaste] = useState(false)

  const copy = useCallback((nodeIds: Set<string> | string[]) => {
    const idSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds)

    const nodes = store.getNodes().filter(n => idSet.has(n.id))
    if (nodes.length === 0) return

    const connections = store.getConnections().filter(
      c => idSet.has(c.fromNodeId) && idSet.has(c.toNodeId),
    )

    bufferRef.current = { nodes, connections }
    setCanPaste(true)
  }, [store])

  const cut = useCallback((nodeIds: Set<string> | string[]) => {
    copy(nodeIds)
    const idSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds)
    store.batch(() => {
      for (const id of idSet) {
        store.removeNode(id)
      }
    })
  }, [store, copy])

  const paste = useCallback((offset?: { x: number; y: number }): FlowNode[] => {
    if (!bufferRef.current) return []

    const dx = offset?.x ?? 20
    const dy = offset?.y ?? 20
    const idMap = new Map<string, string>()

    const newNodes: FlowNode[] = bufferRef.current.nodes.map(node => {
      const newId = generateId()
      idMap.set(node.id, newId)
      return {
        ...node,
        id: newId,
        position: { x: node.position.x + dx, y: node.position.y + dy },
      }
    })

    const newConnections: FlowConnection[] = bufferRef.current.connections.map(conn => ({
      ...conn,
      id: generateId(),
      fromNodeId: idMap.get(conn.fromNodeId)!,
      toNodeId: idMap.get(conn.toNodeId)!,
    }))

    store.batch(() => {
      for (const node of newNodes) store.addNode(node)
      for (const conn of newConnections) store.addConnection(conn)
    })

    return newNodes
  }, [store])

  return { copy, cut, paste, canPaste }
}
