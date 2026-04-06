import { describe, it, expect, vi } from 'vitest'
import { definePlugin } from '../src/plugin/definePlugin'
import { createFlowEditor } from '../src/plugin/createFlowEditor'
import { PinTypeRegistry } from '../src/plugin/PinTypeRegistry'
import { Validator } from '../src/model/Validator'
import { defineNode } from '../src/define/defineNode'
import type { FlowPlugin } from '../src/plugin/types'

const TestNode = defineNode({
  type: 'test/hello',
  label: 'Hello',
  inputs: [{ id: 'in', type: 'string', label: 'Input' }],
  outputs: [{ id: 'out', type: 'string', label: 'Output' }],
})

const TestNode2 = defineNode({
  type: 'test/world',
  label: 'World',
  inputs: [{ id: 'in', type: 'number', label: 'Input' }],
  outputs: [{ id: 'out', type: 'number', label: 'Output' }],
})

describe('definePlugin', () => {
  it('creates a factory function that returns the plugin', () => {
    const factory = definePlugin({ name: 'test-plugin' })
    expect(typeof factory).toBe('function')
    const plugin = factory()
    expect(plugin.name).toBe('test-plugin')
  })

  it('throws when name is empty', () => {
    expect(() => definePlugin({ name: '' })).toThrow('Plugin name must not be empty')
    expect(() => definePlugin({ name: '  ' })).toThrow('Plugin name must not be empty')
  })

  it('returns a new object each call (factory pattern)', () => {
    const factory = definePlugin({ name: 'p', version: '1.0' })
    const a = factory()
    const b = factory()
    expect(a).not.toBe(b)
    expect(a.name).toBe(b.name)
  })
})

describe('PinTypeRegistry', () => {
  it('returns built-in colors', () => {
    const reg = new PinTypeRegistry()
    expect(reg.getColor('exec')).toBe('#71717a')
    expect(reg.getColor('string')).toBe('#a78bfa')
    expect(reg.getColor('number')).toBe('#34d399')
    expect(reg.getColor('boolean')).toBe('#fbbf24')
    expect(reg.getColor('object')).toBe('#60a5fa')
    expect(reg.getColor('array')).toBe('#f472b6')
  })

  it('returns fallback for unknown type', () => {
    const reg = new PinTypeRegistry()
    expect(reg.getColor('fivem:player')).toBe('#6b7280')
  })

  it('registers and retrieves custom pin types', () => {
    const reg = new PinTypeRegistry()
    reg.register('fivem:player', { color: '#22d3ee', label: 'Player' })
    expect(reg.getColor('fivem:player')).toBe('#22d3ee')
    expect(reg.get('fivem:player')).toEqual({ color: '#22d3ee', label: 'Player' })
  })

  it('overrides built-in types', () => {
    const reg = new PinTypeRegistry()
    reg.register('string', { color: '#ff0000', label: 'Custom String' })
    expect(reg.getColor('string')).toBe('#ff0000')
  })

  it('getAll returns all types', () => {
    const reg = new PinTypeRegistry()
    reg.register('custom', { color: '#123456' })
    const all = reg.getAll()
    expect(all.size).toBe(7) // 6 built-in + 1 custom
    expect(all.get('custom')?.color).toBe('#123456')
  })
})

describe('createFlowEditor', () => {
  it('works without any options', () => {
    const editor = createFlowEditor()
    expect(editor.store).toBeDefined()
    expect(editor.registry).toBeDefined()
    expect(editor.validator).toBeDefined()
    expect(editor.pinTypes).toBeDefined()
    expect(editor.history).toBeDefined()
    editor.dispose()
  })

  it('works without plugins (backward compatible)', () => {
    const editor = createFlowEditor({
      initialGraph: {
        nodes: [{
          id: 'n1', type: 'test', label: 'Test', position: { x: 0, y: 0 },
          inputs: [], outputs: [], data: {},
        }],
        connections: [],
      },
    })
    expect(editor.store.getNodes()).toHaveLength(1)
    editor.dispose()
  })

  it('registers plugin nodes in the registry', () => {
    const plugin: FlowPlugin = {
      name: 'test-plugin',
      nodes: [TestNode, TestNode2],
    }
    const editor = createFlowEditor({ plugins: [plugin] })
    expect(editor.registry.has('test/hello')).toBe(true)
    expect(editor.registry.has('test/world')).toBe(true)
    expect(editor.registry.getAll()).toHaveLength(2)
    editor.dispose()
  })

  it('registers plugin pin types', () => {
    const plugin: FlowPlugin = {
      name: 'fivem',
      pinTypes: {
        'fivem:player': { color: '#22d3ee', label: 'Player' },
        'fivem:vehicle': { color: '#f59e0b', label: 'Vehicle' },
      },
    }
    const editor = createFlowEditor({ plugins: [plugin] })
    expect(editor.pinTypes.getColor('fivem:player')).toBe('#22d3ee')
    expect(editor.pinTypes.getColor('fivem:vehicle')).toBe('#f59e0b')
    // Built-ins still exist
    expect(editor.pinTypes.getColor('string')).toBe('#a78bfa')
    editor.dispose()
  })

  it('adds plugin validation rules (array)', () => {
    const plugin: FlowPlugin = {
      name: 'strict',
      rules: [Validator.noSelfConnection(), Validator.noDuplicateConnection()],
    }
    const editor = createFlowEditor({ plugins: [plugin] })

    // Add nodes
    editor.store.addNode({
      id: 'n1', type: 'test', label: 'A', position: { x: 0, y: 0 },
      inputs: [{ id: 'in', type: 'exec', label: '' }],
      outputs: [{ id: 'out', type: 'exec', label: '' }],
      data: {},
    })

    // Self-connection should fail
    expect(() => editor.store.addConnection({
      id: 'c1', fromNodeId: 'n1', fromPinId: 'out', toNodeId: 'n1', toPinId: 'in',
    })).toThrow()

    editor.dispose()
  })

  it('adds plugin validation rules (factory function)', () => {
    const plugin: FlowPlugin = {
      name: 'strict',
      rules: (V) => [V.noSelfConnection()],
    }
    const editor = createFlowEditor({ plugins: [plugin] })

    editor.store.addNode({
      id: 'n1', type: 'test', label: 'A', position: { x: 0, y: 0 },
      inputs: [{ id: 'in', type: 'exec', label: '' }],
      outputs: [{ id: 'out', type: 'exec', label: '' }],
      data: {},
    })

    expect(() => editor.store.addConnection({
      id: 'c1', fromNodeId: 'n1', fromPinId: 'out', toNodeId: 'n1', toPinId: 'in',
    })).toThrow()

    editor.dispose()
  })

  it('setup receives the correct context', () => {
    const setupFn = vi.fn()
    const plugin: FlowPlugin = {
      name: 'ctx-test',
      setup: setupFn,
    }
    const editor = createFlowEditor({ plugins: [plugin] })

    expect(setupFn).toHaveBeenCalledOnce()
    const ctx = setupFn.mock.calls[0][0]
    expect(ctx.store).toBe(editor.store)
    expect(ctx.registry).toBe(editor.registry)
    expect(ctx.validator).toBe(editor.validator)
    expect(ctx.pinTypes).toBe(editor.pinTypes)

    editor.dispose()
  })

  it('dispose calls cleanup functions from setup', () => {
    const cleanup = vi.fn()
    const plugin: FlowPlugin = {
      name: 'cleanup-test',
      setup: () => cleanup,
    }
    const editor = createFlowEditor({ plugins: [plugin] })
    expect(cleanup).not.toHaveBeenCalled()
    editor.dispose()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('dispose handles setup without cleanup', () => {
    const plugin: FlowPlugin = {
      name: 'no-cleanup',
      setup: () => { /* no return */ },
    }
    const editor = createFlowEditor({ plugins: [plugin] })
    expect(() => editor.dispose()).not.toThrow()
  })

  it('supports plugin factories (functions)', () => {
    const factory = definePlugin({
      name: 'factory-test',
      nodes: [TestNode],
    })
    const editor = createFlowEditor({ plugins: [factory] })
    expect(editor.registry.has('test/hello')).toBe(true)
    editor.dispose()
  })

  it('creates HistoryManager when history is enabled', () => {
    const editor = createFlowEditor({ history: true })
    expect(editor.history).not.toBeNull()
    editor.dispose()
  })

  it('does not create HistoryManager when history is false', () => {
    const editor = createFlowEditor({ history: false })
    expect(editor.history).toBeNull()
    editor.dispose()
  })

  it('accepts a Validator instance', () => {
    const v = new Validator([Validator.noSelfConnection()])
    const editor = createFlowEditor({ validator: v })
    expect(editor.validator).toBe(v)
    editor.dispose()
  })

  it('accepts ValidationRule[] as validator', () => {
    const editor = createFlowEditor({
      validator: [Validator.noSelfConnection()],
    })

    editor.store.addNode({
      id: 'n1', type: 'test', label: 'A', position: { x: 0, y: 0 },
      inputs: [{ id: 'in', type: 'exec', label: '' }],
      outputs: [{ id: 'out', type: 'exec', label: '' }],
      data: {},
    })

    expect(() => editor.store.addConnection({
      id: 'c1', fromNodeId: 'n1', fromPinId: 'out', toNodeId: 'n1', toPinId: 'in',
    })).toThrow()

    editor.dispose()
  })

  it('composes multiple plugins', () => {
    const pluginA: FlowPlugin = {
      name: 'plugin-a',
      nodes: [TestNode],
      pinTypes: { 'custom:a': { color: '#111111' } },
    }
    const pluginB: FlowPlugin = {
      name: 'plugin-b',
      nodes: [TestNode2],
      pinTypes: { 'custom:b': { color: '#222222' } },
    }
    const editor = createFlowEditor({ plugins: [pluginA, pluginB] })

    expect(editor.registry.has('test/hello')).toBe(true)
    expect(editor.registry.has('test/world')).toBe(true)
    expect(editor.pinTypes.getColor('custom:a')).toBe('#111111')
    expect(editor.pinTypes.getColor('custom:b')).toBe('#222222')

    editor.dispose()
  })
})
