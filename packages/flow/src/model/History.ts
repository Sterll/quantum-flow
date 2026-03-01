import type { FlowGraph } from '../types'
import { GraphModel } from './GraphModel'

export class History {
  private past: FlowGraph[] = []
  private future: FlowGraph[] = []
  private maxSize: number

  constructor(private model: GraphModel, maxSize = 50) {
    this.maxSize = maxSize
  }

  snapshot(): void {
    this.past.push(this.model.serialize())
    if (this.past.length > this.maxSize) {
      this.past.shift()
    }
    this.future = []
  }

  undo(): void {
    if (this.past.length < 2) return
    const current = this.past.pop()!
    this.future.unshift(current)
    const previous = this.past[this.past.length - 1]
    this.restore(previous)
  }

  redo(): void {
    if (this.future.length === 0) return
    const next = this.future.shift()!
    this.past.push(next)
    this.restore(next)
  }

  canUndo(): boolean {
    return this.past.length > 1
  }

  canRedo(): boolean {
    return this.future.length > 0
  }

  private restore(graph: FlowGraph): void {
    const restored = GraphModel.fromJSON(graph)
    const nodes = this.model.getNodes()
    nodes.forEach(n => this.model.removeNode(n.id))
    restored.getNodes().forEach(n => this.model.addNode(n))
    restored.getConnections().forEach(c => this.model.addConnection(c))
  }
}
