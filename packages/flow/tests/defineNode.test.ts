import { describe, it, expect } from 'vitest'
import { defineNode, NodeRegistry } from '../src/define'

describe('defineNode', () => {
  it('doit enregistrer un node dans le registry', () => {
    const registry = new NodeRegistry()
    const MyNode = defineNode({
      type: 'test/my-node',
      label: 'My Node',
      inputs: [{ id: 'exec', type: 'exec', label: '' }],
      outputs: [{ id: 'exec', type: 'exec', label: '' }],
    })
    registry.register(MyNode)
    expect(registry.get('test/my-node')).toBeDefined()
  })

  it('doit créer une instance de FlowNode depuis une définition', () => {
    const MyNode = defineNode({
      type: 'test/my-node',
      label: 'My Node',
      inputs: [],
      outputs: [],
    })
    const instance = MyNode.createInstance({ x: 100, y: 200 })
    expect(instance.type).toBe('test/my-node')
    expect(instance.position).toEqual({ x: 100, y: 200 })
    expect(instance.id).toBeTruthy()
  })

  it('generates unique IDs using crypto.randomUUID pattern', () => {
    const MyNode = defineNode({
      type: 'test/node',
      label: 'Test',
      inputs: [],
      outputs: [],
    })
    const a = MyNode.createInstance({ x: 0, y: 0 })
    const b = MyNode.createInstance({ x: 0, y: 0 })
    expect(a.id).not.toBe(b.id)
    expect(a.id.length).toBeGreaterThan(10)
  })

  it('rejects duplicate pin IDs on same node', () => {
    expect(() => defineNode({
      type: 'test/bad',
      label: 'Bad',
      inputs: [
        { id: 'dup', type: 'string', label: 'A' },
        { id: 'dup', type: 'number', label: 'B' },
      ],
      outputs: [],
    })).toThrow('Duplicate pin ID')
  })

  it('supports category field', () => {
    const MyNode = defineNode({
      type: 'event/trigger',
      label: 'Trigger',
      category: 'Events',
      inputs: [],
      outputs: [],
    })
    expect(MyNode.category).toBe('Events')
  })

  it('NodeRegistry.has checks existence', () => {
    const registry = new NodeRegistry()
    const MyNode = defineNode({ type: 'test/a', label: 'A', inputs: [], outputs: [] })
    expect(registry.has('test/a')).toBe(false)
    registry.register(MyNode)
    expect(registry.has('test/a')).toBe(true)
  })

  it('NodeRegistry.unregister removes a definition', () => {
    const registry = new NodeRegistry()
    const MyNode = defineNode({ type: 'test/a', label: 'A', inputs: [], outputs: [] })
    registry.register(MyNode)
    registry.unregister('test/a')
    expect(registry.has('test/a')).toBe(false)
  })

  it('NodeRegistry.getCategories groups by namespace', () => {
    const registry = new NodeRegistry()
    registry.register(defineNode({ type: 'event/a', label: 'A', inputs: [], outputs: [] }))
    registry.register(defineNode({ type: 'event/b', label: 'B', inputs: [], outputs: [] }))
    registry.register(defineNode({ type: 'logic/c', label: 'C', inputs: [], outputs: [] }))
    const cats = registry.getCategories()
    expect(cats.get('event')).toHaveLength(2)
    expect(cats.get('logic')).toHaveLength(1)
  })
})
