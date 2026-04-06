import { describe, it, expect } from 'vitest'
import { GraphStore } from '../src/model/GraphStore'
import { createGroup, addNodesToGroup, removeNodesFromGroup, autoSizeGroup } from '../src/model/groupHelpers'
import { GROUP_NODE_TYPE } from '../src/hooks/hitTest'
import type { FlowNode } from '../src/types'

const makeNode = (id: string, x = 0, y = 0): FlowNode => ({
  id, type: 'test/node', label: id,
  position: { x, y },
  inputs: [{ id: 'in', type: 'exec', label: '' }],
  outputs: [{ id: 'out', type: 'exec', label: '' }],
  data: {},
})

describe('groupHelpers', () => {
  describe('createGroup', () => {
    it('creates a group node wrapping the selected nodes', () => {
      const store = new GraphStore()
      store.addNode(makeNode('n1', 100, 100))
      store.addNode(makeNode('n2', 300, 200))

      const groupId = createGroup(store, ['n1', 'n2'])
      expect(groupId).toBeTruthy()

      const group = store.getNode(groupId)!
      expect(group.type).toBe(GROUP_NODE_TYPE)
      expect(group.data.childIds).toEqual(['n1', 'n2'])
    })

    it('returns empty string for empty selection', () => {
      const store = new GraphStore()
      const result = createGroup(store, [])
      expect(result).toBe('')
    })

    it('skips existing group nodes in selection', () => {
      const store = new GraphStore()
      store.addNode(makeNode('n1', 100, 100))
      store.addNode({
        id: 'g1', type: GROUP_NODE_TYPE, label: 'Group',
        position: { x: 50, y: 50 }, inputs: [], outputs: [],
        data: { childIds: ['n1'], groupWidth: 300, groupHeight: 200 },
      })

      const groupId = createGroup(store, ['n1', 'g1'])
      const group = store.getNode(groupId)!
      expect(group.data.childIds).toEqual(['n1', 'g1'])
    })

    it('uses custom label and color', () => {
      const store = new GraphStore()
      store.addNode(makeNode('n1', 0, 0))

      const groupId = createGroup(store, ['n1'], 'My Group', '#ff0000')
      const group = store.getNode(groupId)!
      expect(group.label).toBe('My Group')
      expect(group.data.groupColor).toBe('#ff0000')
    })

    it('generates unique IDs (SSR-safe)', () => {
      const store = new GraphStore()
      store.addNode(makeNode('n1', 0, 0))
      store.addNode(makeNode('n2', 100, 100))

      const id1 = createGroup(store, ['n1'])
      const id2 = createGroup(store, ['n2'])
      expect(id1).not.toBe(id2)
      expect(id1.startsWith('group_')).toBe(true)
    })
  })

  describe('addNodesToGroup', () => {
    it('adds nodes to existing group', () => {
      const store = new GraphStore()
      store.addNode(makeNode('n1', 100, 100))
      store.addNode(makeNode('n2', 200, 200))
      store.addNode(makeNode('n3', 300, 300))

      const groupId = createGroup(store, ['n1'])
      addNodesToGroup(store, groupId, ['n2', 'n3'])

      const group = store.getNode(groupId)!
      expect(group.data.childIds).toContain('n2')
      expect(group.data.childIds).toContain('n3')
    })

    it('does nothing for non-group node', () => {
      const store = new GraphStore()
      store.addNode(makeNode('n1', 0, 0))
      addNodesToGroup(store, 'n1', ['n2'])
      // No crash, n1 still a regular node
      expect(store.getNode('n1')!.type).toBe('test/node')
    })
  })

  describe('removeNodesFromGroup', () => {
    it('removes nodes from group', () => {
      const store = new GraphStore()
      store.addNode(makeNode('n1', 100, 100))
      store.addNode(makeNode('n2', 200, 200))

      const groupId = createGroup(store, ['n1', 'n2'])
      removeNodesFromGroup(store, groupId, ['n1'])

      const group = store.getNode(groupId)!
      expect(group.data.childIds).toEqual(['n2'])
    })

    it('deletes group when last node is removed', () => {
      const store = new GraphStore()
      store.addNode(makeNode('n1', 100, 100))

      const groupId = createGroup(store, ['n1'])
      removeNodesFromGroup(store, groupId, ['n1'])

      expect(store.getNode(groupId)).toBeUndefined()
    })
  })

  describe('autoSizeGroup', () => {
    it('resizes group to fit children', () => {
      const store = new GraphStore()
      store.addNode(makeNode('n1', 100, 100))
      store.addNode(makeNode('n2', 400, 400))

      const groupId = createGroup(store, ['n1', 'n2'])

      // Move a child node
      store.moveNode('n2', { x: 500, y: 500 })
      autoSizeGroup(store, groupId)

      const group = store.getNode(groupId)!
      expect(group.position.x).toBeLessThan(100) // padding before n1
      expect((group.data.groupWidth as number)).toBeGreaterThan(400) // spans n1 to n2
    })

    it('does nothing for non-group node', () => {
      const store = new GraphStore()
      store.addNode(makeNode('n1', 0, 0))
      autoSizeGroup(store, 'n1') // should not crash
      expect(store.getNode('n1')!.position).toEqual({ x: 0, y: 0 })
    })
  })
})
