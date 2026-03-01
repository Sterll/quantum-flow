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
})
