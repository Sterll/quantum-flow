import type { FlowGraph, FlowNodePosition } from '../types'
import { nodeHeight } from '../hooks/hitTest'
import { NODE_W } from '../constants'

export interface AutoLayoutOptions {
  direction?: 'LR' | 'TB'
  nodeSpacingX?: number
  nodeSpacingY?: number
  padding?: number
}

/**
 * Simple layered auto-layout (Sugiyama-style) for directed graphs.
 * No external dependencies - built-in topological sort + layering.
 *
 * For more advanced layouts (force-directed, elk), use the returned positions
 * as a starting point or plug in dagre/elkjs externally.
 */
export function autoLayout(
  graph: FlowGraph,
  options?: AutoLayoutOptions,
): Map<string, FlowNodePosition> {
  const dir = options?.direction ?? 'LR'
  const spacingX = options?.nodeSpacingX ?? 80
  const spacingY = options?.nodeSpacingY ?? 40
  const padding = options?.padding ?? 60

  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))
  const outEdges = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  // Initialize
  for (const node of graph.nodes) {
    outEdges.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  // Build adjacency (exec connections define flow direction, data connections follow)
  for (const conn of graph.connections) {
    const targets = outEdges.get(conn.fromNodeId)
    if (targets) targets.push(conn.toNodeId)
    inDegree.set(conn.toNodeId, (inDegree.get(conn.toNodeId) ?? 0) + 1)
  }

  // Topological sort (Kahn's algorithm) to assign layers
  const queue: string[] = []
  const layerOf = new Map<string, number>()

  for (const [nodeId, deg] of inDegree) {
    if (deg === 0) {
      queue.push(nodeId)
      layerOf.set(nodeId, 0)
    }
  }

  // Handle cycles: assign remaining nodes to layer 0
  if (queue.length === 0 && graph.nodes.length > 0) {
    queue.push(graph.nodes[0].id)
    layerOf.set(graph.nodes[0].id, 0)
  }

  let head = 0
  while (head < queue.length) {
    const nodeId = queue[head++]
    const currentLayer = layerOf.get(nodeId) ?? 0
    const targets = outEdges.get(nodeId) ?? []

    for (const targetId of targets) {
      if (layerOf.has(targetId)) {
        // Already assigned - push to max layer
        layerOf.set(targetId, Math.max(layerOf.get(targetId)!, currentLayer + 1))
        continue
      }
      layerOf.set(targetId, currentLayer + 1)
      inDegree.set(targetId, (inDegree.get(targetId) ?? 1) - 1)
      if ((inDegree.get(targetId) ?? 0) <= 0) {
        queue.push(targetId)
      }
    }
  }

  // Assign unvisited nodes (disconnected components) to layer 0
  for (const node of graph.nodes) {
    if (!layerOf.has(node.id)) {
      layerOf.set(node.id, 0)
    }
  }

  // Group nodes by layer
  const layers = new Map<number, string[]>()
  for (const [nodeId, layer] of layerOf) {
    if (!layers.has(layer)) layers.set(layer, [])
    layers.get(layer)!.push(nodeId)
  }

  // Calculate positions
  const positions = new Map<string, FlowNodePosition>()
  const maxLayer = Math.max(...layers.keys(), 0)

  for (let layer = 0; layer <= maxLayer; layer++) {
    const nodesInLayer = layers.get(layer) ?? []

    for (let order = 0; order < nodesInLayer.length; order++) {
      const nodeId = nodesInLayer[order]
      const node = nodeMap.get(nodeId)
      if (!node) continue

      const w = node.width ?? NODE_W
      const h = nodeHeight(node)

      if (dir === 'LR') {
        positions.set(nodeId, {
          x: padding + layer * (w + spacingX),
          y: padding + order * (h + spacingY),
        })
      } else {
        positions.set(nodeId, {
          x: padding + order * (w + spacingX),
          y: padding + layer * (h + spacingY),
        })
      }
    }
  }

  return positions
}

/**
 * Apply auto-layout positions to a GraphStore.
 * Wraps in a batch so it's a single undo step.
 */
export function applyAutoLayout(
  store: { getState(): FlowGraph; moveNode(id: string, pos: FlowNodePosition): void; batch(fn: () => void): void },
  options?: AutoLayoutOptions,
): void {
  const graph = store.getState()
  const positions = autoLayout(graph, options)

  store.batch(() => {
    for (const [nodeId, pos] of positions) {
      store.moveNode(nodeId, pos)
    }
  })
}
