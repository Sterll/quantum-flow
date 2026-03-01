import type { FlowNode } from './node.types'
import type { FlowConnection } from './connection.types'

export interface FlowGraph {
  nodes: FlowNode[]
  connections: FlowConnection[]
}
