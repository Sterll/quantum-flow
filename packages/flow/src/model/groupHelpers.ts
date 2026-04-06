import type { GraphStore } from './GraphStore'
import type { FlowNode } from '../types'
import { nodeHeight, GROUP_NODE_TYPE } from '../hooks/hitTest'
import { NODE_W, GROUP_HEADER_H } from '../constants'

export function createGroup(
  store: GraphStore,
  nodeIds: string[],
  label = 'Group',
  color = '#6366f1',
): string {
  const nodes = nodeIds
    .map(id => store.getNode(id))
    .filter((n): n is FlowNode => n != null && n.type !== GROUP_NODE_TYPE)

  if (nodes.length === 0) return ''

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    const w = n.width ?? NODE_W
    const h = nodeHeight(n)
    if (n.position.x < minX) minX = n.position.x
    if (n.position.y < minY) minY = n.position.y
    if (n.position.x + w > maxX) maxX = n.position.x + w
    if (n.position.y + h > maxY) maxY = n.position.y + h
  }

  const padding = 24
  const id = `group_${crypto.randomUUID()}`
  const group: FlowNode = {
    id,
    type: GROUP_NODE_TYPE,
    label,
    position: { x: minX - padding, y: minY - padding - GROUP_HEADER_H },
    inputs: [],
    outputs: [],
    data: {
      childIds: nodeIds,
      groupWidth: (maxX - minX) + padding * 2,
      groupHeight: (maxY - minY) + padding * 2 + GROUP_HEADER_H,
      groupColor: color,
    },
  }

  store.addNode(group)
  return id
}

export function addNodesToGroup(store: GraphStore, groupId: string, nodeIds: string[]): void {
  const group = store.getNode(groupId)
  if (!group || group.type !== GROUP_NODE_TYPE) return
  const current = (group.data.childIds as string[]) ?? []
  const next = Array.from(new Set([...current, ...nodeIds]))
  store.updateNodeData(groupId, { childIds: next })
  autoSizeGroup(store, groupId)
}

export function removeNodesFromGroup(store: GraphStore, groupId: string, nodeIds: string[]): void {
  const group = store.getNode(groupId)
  if (!group || group.type !== GROUP_NODE_TYPE) return
  const current = (group.data.childIds as string[]) ?? []
  const remove = new Set(nodeIds)
  const remaining = current.filter(id => !remove.has(id))
  if (remaining.length === 0) {
    store.removeNode(groupId)
    return
  }
  store.updateNodeData(groupId, { childIds: remaining })
  autoSizeGroup(store, groupId)
}

export function autoSizeGroup(store: GraphStore, groupId: string): void {
  const group = store.getNode(groupId)
  if (!group || group.type !== GROUP_NODE_TYPE) return
  const childIds = (group.data.childIds as string[]) ?? []
  const nodes = childIds
    .map(id => store.getNode(id))
    .filter((n): n is FlowNode => n != null)

  if (nodes.length === 0) return

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    const w = n.width ?? NODE_W
    const h = nodeHeight(n)
    if (n.position.x < minX) minX = n.position.x
    if (n.position.y < minY) minY = n.position.y
    if (n.position.x + w > maxX) maxX = n.position.x + w
    if (n.position.y + h > maxY) maxY = n.position.y + h
  }

  const padding = 24
  store.moveNode(groupId, { x: minX - padding, y: minY - padding - GROUP_HEADER_H })
  store.updateNodeData(groupId, {
    groupWidth: (maxX - minX) + padding * 2,
    groupHeight: (maxY - minY) + padding * 2 + GROUP_HEADER_H,
  })
}
