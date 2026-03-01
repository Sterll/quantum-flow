import { describe, it, expect } from 'vitest'
import { hitTestNode, hitTestPin } from '../src/hooks/hitTest'
import type { FlowNode } from '../src/types'

const makeNode = (id: string, x: number, y: number, inputs: Array<{ id: string; type: string }> = [], outputs: Array<{ id: string; type: string }> = []): FlowNode => ({
  id,
  type: 'test/node',
  label: id,
  position: { x, y },
  inputs: inputs.map(p => ({ ...p, label: p.id })),
  outputs: outputs.map(p => ({ ...p, label: p.id })),
  data: {},
})

describe('hitTest', () => {
  describe('hitTestNode', () => {
    it('returns node when point is inside bounding box', () => {
      const nodes = [makeNode('n1', 100, 100)]
      const result = hitTestNode({ x: 150, y: 120 }, nodes)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('n1')
    })

    it('returns null when point is outside all nodes', () => {
      const nodes = [makeNode('n1', 100, 100)]
      const result = hitTestNode({ x: 0, y: 0 }, nodes)
      expect(result).toBeNull()
    })

    it('returns topmost node (last in array) when overlapping', () => {
      const nodes = [
        makeNode('n1', 100, 100),
        makeNode('n2', 110, 110),
      ]
      const result = hitTestNode({ x: 150, y: 130 }, nodes)
      expect(result!.id).toBe('n2')
    })
  })

  describe('hitTestPin', () => {
    it('returns output pin when point is near right edge pin position', () => {
      const nodes = [makeNode('n1', 100, 100, [], [{ id: 'out', type: 'exec' }])]
      // Output pin is at x=100+220=320, y=100+40+11=151
      const result = hitTestPin({ x: 320, y: 151 }, nodes)
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('n1')
      expect(result!.pinId).toBe('out')
      expect(result!.isOutput).toBe(true)
    })

    it('returns input pin when point is near left edge pin position', () => {
      const nodes = [makeNode('n1', 100, 100, [{ id: 'in', type: 'string' }], [])]
      // Input pin is at x=100, y=100+40+11=151
      const result = hitTestPin({ x: 100, y: 151 }, nodes)
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('n1')
      expect(result!.pinId).toBe('in')
      expect(result!.isOutput).toBe(false)
    })

    it('returns null when no pin is near the point', () => {
      const nodes = [makeNode('n1', 100, 100, [{ id: 'in', type: 'string' }], [])]
      const result = hitTestPin({ x: 200, y: 200 }, nodes)
      expect(result).toBeNull()
    })

    it('pin hit takes priority with generous radius', () => {
      const nodes = [makeNode('n1', 100, 100, [{ id: 'in', type: 'exec' }], [])]
      // Slightly off from exact pin position — within 10px radius
      const result = hitTestPin({ x: 105, y: 155 }, nodes)
      expect(result).not.toBeNull()
    })
  })
})
