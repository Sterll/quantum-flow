import type { FlowGraph } from '../types'
import type { GraphStore, GraphEvents } from './GraphStore'

interface HistoryEntry {
  label: string
  timestamp: number
  state: FlowGraph
}

export interface HistoryManagerOptions {
  maxSize?: number
}

export class HistoryManager {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private maxSize: number
  private store: GraphStore
  private initialCaptured = false
  private restoring = false
  private batchDepth = 0
  private batchLabel = ''

  constructor(store: GraphStore, options?: HistoryManagerOptions) {
    this.store = store
    this.maxSize = options?.maxSize ?? 50
    this.subscribe()
  }

  undo(): boolean {
    if (!this.canUndo()) return false
    const current = this.undoStack.pop()!
    this.redoStack.push(current)
    const previous = this.undoStack[this.undoStack.length - 1]
    this.restoring = true
    this.store.importGraph(previous.state)
    this.restoring = false
    return true
  }

  redo(): boolean {
    if (!this.canRedo()) return false
    const next = this.redoStack.pop()!
    this.undoStack.push(next)
    this.restoring = true
    this.store.importGraph(next.state)
    this.restoring = false
    return true
  }

  canUndo(): boolean {
    return this.undoStack.length > 1
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.initialCaptured = false
  }

  getUndoStack(): Array<{ label: string; timestamp: number }> {
    return this.undoStack.map(e => ({ label: e.label, timestamp: e.timestamp }))
  }

  getRedoStack(): Array<{ label: string; timestamp: number }> {
    return this.redoStack.map(e => ({ label: e.label, timestamp: e.timestamp }))
  }

  private subscribe(): void {
    const mutationEvents: Array<keyof GraphEvents> = [
      'node:added', 'node:removed', 'node:moved', 'node:dataChanged',
      'connection:added', 'connection:removed', 'graph:cleared',
      'graph:imported',
    ]

    for (const event of mutationEvents) {
      this.store.events.on(event, (payload: unknown) => {
        if (this.restoring) return
        if (this.batchDepth > 0) {
          if (!this.batchLabel) this.batchLabel = this.labelFromEvent(event as string, payload)
          return
        }
        this.captureSnapshot(this.labelFromEvent(event as string, payload))
      })
    }

    this.store.events.on('batch:start', () => {
      if (this.restoring) return
      this.batchDepth++
      this.batchLabel = ''
    })

    this.store.events.on('batch:end', () => {
      if (this.restoring) return
      this.batchDepth--
      if (this.batchDepth === 0) {
        this.captureSnapshot(this.batchLabel || 'Batch operation')
        this.batchLabel = ''
      }
    })
  }

  private captureSnapshot(label: string): void {
    if (!this.initialCaptured) {
      this.initialCaptured = true
      this.undoStack.push({
        label: 'Initial state',
        timestamp: Date.now(),
        state: { nodes: [], connections: [] },
      })
    }

    this.undoStack.push({
      label,
      timestamp: Date.now(),
      state: this.store.getState(),
    })

    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift()
    }

    this.redoStack = []
  }

  private labelFromEvent(event: string, payload: unknown): string {
    const p = payload as Record<string, any>
    switch (event) {
      case 'node:added': return `Added node '${p.node?.label ?? p.node?.id}'`
      case 'node:removed': return `Removed node '${p.nodeId}'`
      case 'node:moved': return `Moved node '${p.nodeId}'`
      case 'node:dataChanged': return `Updated data on '${p.nodeId}'`
      case 'connection:added': return `Connected ${p.connection?.fromNodeId} -> ${p.connection?.toNodeId}`
      case 'connection:removed': return `Removed connection '${p.connectionId}'`
      case 'graph:cleared': return 'Cleared graph'
      case 'graph:imported': return 'Imported graph'
      default: return event
    }
  }
}
