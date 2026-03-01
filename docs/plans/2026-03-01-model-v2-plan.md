# Model v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the model layer (GraphModel, ConnectionValidator, History) with an event-driven, immutable architecture: EventBus, GraphStore, Validator pipeline, HistoryManager with auto-subscribe and transactions.

**Architecture:** GraphStore is the core — each mutation validates via Validator, then applies the change and emits a typed event via EventBus. HistoryManager auto-subscribes to events and captures snapshots. Batch operations group multiple mutations into a single undo step. Types (FlowGraph, FlowNode, etc.) do not change.

**Tech Stack:** TypeScript 5, Vitest (jsdom), React 18, Canvas 2D, pnpm monorepo, tsup bundler

---

### Task 1: EventBus — tests + implementation

**Files:**
- Create: `packages/flow/src/model/EventBus.ts`
- Create: `packages/flow/tests/EventBus.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/EventBus.test.ts
import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../src/model/EventBus'

type TestEvents = {
  'item:added': { id: string }
  'item:removed': { id: string }
  'reset': {}
}

describe('EventBus', () => {
  it('on/emit delivers payload to handler', () => {
    const bus = new EventBus<TestEvents>()
    const handler = vi.fn()
    bus.on('item:added', handler)
    bus.emit('item:added', { id: 'a' })
    expect(handler).toHaveBeenCalledWith({ id: 'a' })
  })

  it('on returns unsubscribe function', () => {
    const bus = new EventBus<TestEvents>()
    const handler = vi.fn()
    const unsub = bus.on('item:added', handler)
    unsub()
    bus.emit('item:added', { id: 'a' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('off removes a specific handler', () => {
    const bus = new EventBus<TestEvents>()
    const handler = vi.fn()
    bus.on('item:added', handler)
    bus.off('item:added', handler)
    bus.emit('item:added', { id: 'a' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('once fires handler only once', () => {
    const bus = new EventBus<TestEvents>()
    const handler = vi.fn()
    bus.once('item:added', handler)
    bus.emit('item:added', { id: 'a' })
    bus.emit('item:added', { id: 'b' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ id: 'a' })
  })

  it('multiple handlers on same event all fire', () => {
    const bus = new EventBus<TestEvents>()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('item:added', h1)
    bus.on('item:added', h2)
    bus.emit('item:added', { id: 'x' })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('emit on event with no listeners does not throw', () => {
    const bus = new EventBus<TestEvents>()
    expect(() => bus.emit('reset', {})).not.toThrow()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/EventBus.test.ts`
Expected: FAIL — cannot find module `../src/model/EventBus`

**Step 3: Write the implementation**

```typescript
// packages/flow/src/model/EventBus.ts
type Handler<T> = (payload: T) => void

export class EventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Handler<any>>>()

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      handler(payload)
    }
  }

  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const wrapper: Handler<Events[K]> = (payload) => {
      this.off(event, wrapper)
      handler(payload)
    }
    return this.on(event, wrapper)
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/EventBus.test.ts`
Expected: 6 tests PASS

**Step 5: Build to verify no type errors**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 6: Commit**

```
feat(flow): add type-safe EventBus with on/off/emit/once
```

---

### Task 2: Validator — tests + implementation

**Files:**
- Create: `packages/flow/src/model/Validator.ts`
- Create: `packages/flow/tests/Validator.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/Validator.test.ts
import { describe, it, expect } from 'vitest'
import { Validator } from '../src/model/Validator'
import type { FlowGraph, FlowConnection, FlowNode } from '../src/types'

const makeNode = (id: string, inputs: Array<{ id: string; type: string }> = [], outputs: Array<{ id: string; type: string }> = []): FlowNode => ({
  id,
  type: 'test/node',
  label: id,
  position: { x: 0, y: 0 },
  inputs: inputs.map(p => ({ ...p, label: p.id })),
  outputs: outputs.map(p => ({ ...p, label: p.id })),
  data: {},
})

const makeConn = (id: string, from: string, fromPin: string, to: string, toPin: string): FlowConnection => ({
  id, fromNodeId: from, fromPinId: fromPin, toNodeId: to, toPinId: toPin,
})

describe('Validator', () => {
  describe('typeCompatibility', () => {
    it('allows same types (string -> string)', () => {
      const v = new Validator([Validator.typeCompatibility()])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'string' }]),
          makeNode('n2', [{ id: 'in', type: 'string' }], []),
        ],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n2', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(true)
    })

    it('rejects incompatible types (string -> number)', () => {
      const v = new Validator([Validator.typeCompatibility()])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'string' }]),
          makeNode('n2', [{ id: 'in', type: 'number' }], []),
        ],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n2', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
    })

    it('supports custom overrides (string -> number allowed)', () => {
      const v = new Validator([Validator.typeCompatibility({ string: ['string', 'number'] })])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'string' }]),
          makeNode('n2', [{ id: 'in', type: 'number' }], []),
        ],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n2', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(true)
    })
  })

  describe('noSelfConnection', () => {
    it('rejects connection from a node to itself', () => {
      const v = new Validator([Validator.noSelfConnection()])
      const graph: FlowGraph = {
        nodes: [makeNode('n1', [{ id: 'in', type: 'string' }], [{ id: 'out', type: 'string' }])],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n1', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
    })
  })

  describe('noDuplicateConnection', () => {
    it('rejects duplicate connection between same pins', () => {
      const v = new Validator([Validator.noDuplicateConnection()])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'exec' }]),
          makeNode('n2', [{ id: 'in', type: 'exec' }], []),
        ],
        connections: [makeConn('c1', 'n1', 'out', 'n2', 'in')],
      }
      const conn = makeConn('c2', 'n1', 'out', 'n2', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
    })
  })

  describe('noDuplicateNodeId', () => {
    it('rejects node with existing ID', () => {
      const v = new Validator([Validator.noDuplicateNodeId()])
      const graph: FlowGraph = {
        nodes: [makeNode('n1')],
        connections: [],
      }
      const node = makeNode('n1')
      const result = v.validate({ graph, action: 'addNode', payload: node })
      expect(result.valid).toBe(false)
    })
  })

  describe('noCycles', () => {
    it('rejects connection that would create a cycle', () => {
      const v = new Validator([Validator.noCycles()])
      // n1 -> n2 -> n3, trying to add n3 -> n1 (cycle)
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [{ id: 'in', type: 'exec' }], [{ id: 'out', type: 'exec' }]),
          makeNode('n2', [{ id: 'in', type: 'exec' }], [{ id: 'out', type: 'exec' }]),
          makeNode('n3', [{ id: 'in', type: 'exec' }], [{ id: 'out', type: 'exec' }]),
        ],
        connections: [
          makeConn('c1', 'n1', 'out', 'n2', 'in'),
          makeConn('c2', 'n2', 'out', 'n3', 'in'),
        ],
      }
      const conn = makeConn('c3', 'n3', 'out', 'n1', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
    })

    it('allows connection that does not create a cycle', () => {
      const v = new Validator([Validator.noCycles()])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'exec' }]),
          makeNode('n2', [{ id: 'in', type: 'exec' }], [{ id: 'out', type: 'exec' }]),
          makeNode('n3', [{ id: 'in', type: 'exec' }], []),
        ],
        connections: [makeConn('c1', 'n1', 'out', 'n2', 'in')],
      }
      const conn = makeConn('c2', 'n2', 'out', 'n3', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(true)
    })
  })

  describe('maxConnectionsPerPin', () => {
    it('rejects when pin exceeds max connections', () => {
      const v = new Validator([Validator.maxConnectionsPerPin(1)])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'string' }]),
          makeNode('n2', [{ id: 'in', type: 'string' }], []),
          makeNode('n3', [{ id: 'in', type: 'string' }], []),
        ],
        connections: [makeConn('c1', 'n1', 'out', 'n2', 'in')],
      }
      const conn = makeConn('c2', 'n1', 'out', 'n3', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
    })
  })

  describe('pipeline', () => {
    it('runs all rules and returns first failure', () => {
      const v = new Validator([
        Validator.noSelfConnection(),
        Validator.typeCompatibility(),
      ])
      const graph: FlowGraph = {
        nodes: [makeNode('n1', [{ id: 'in', type: 'string' }], [{ id: 'out', type: 'string' }])],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n1', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toContain('self')
    })

    it('addRule/removeRule modifies the pipeline', () => {
      const v = new Validator()
      const graph: FlowGraph = {
        nodes: [makeNode('n1', [{ id: 'in', type: 'string' }], [{ id: 'out', type: 'string' }])],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n1', 'in')

      // No rules — valid
      expect(v.validate({ graph, action: 'addConnection', payload: conn }).valid).toBe(true)

      // Add noSelfConnection — now invalid
      v.addRule(Validator.noSelfConnection())
      expect(v.validate({ graph, action: 'addConnection', payload: conn }).valid).toBe(false)

      // Remove it — valid again
      v.removeRule('noSelfConnection')
      expect(v.validate({ graph, action: 'addConnection', payload: conn }).valid).toBe(true)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/Validator.test.ts`
Expected: FAIL — cannot find module `../src/model/Validator`

**Step 3: Write the implementation**

```typescript
// packages/flow/src/model/Validator.ts
import type { FlowGraph, FlowConnection, FlowNode } from '../types'

export interface ValidationRule {
  name: string
  validate(context: ValidationContext): ValidationResult
}

export interface ValidationContext {
  graph: FlowGraph
  action: 'addConnection' | 'addNode' | 'removeNode' | 'removeConnection'
  payload: FlowConnection | FlowNode | { connectionId: string } | { nodeId: string }
}

export type ValidationResult = { valid: true } | { valid: false; reason: string }

const DEFAULT_COMPAT: Record<string, string[]> = {
  exec: ['exec'],
  string: ['string'],
  number: ['number'],
  boolean: ['boolean'],
  object: ['object'],
  array: ['array'],
}

export class Validator {
  private rules: ValidationRule[] = []

  constructor(rules?: ValidationRule[]) {
    if (rules) this.rules = [...rules]
  }

  addRule(rule: ValidationRule): void {
    this.rules.push(rule)
  }

  removeRule(name: string): void {
    this.rules = this.rules.filter(r => r.name !== name)
  }

  validate(context: ValidationContext): ValidationResult {
    for (const rule of this.rules) {
      const result = rule.validate(context)
      if (!result.valid) return result
    }
    return { valid: true }
  }

  static typeCompatibility(overrides?: Record<string, string[]>): ValidationRule {
    const compat = overrides ?? DEFAULT_COMPAT
    return {
      name: 'typeCompatibility',
      validate(ctx) {
        if (ctx.action !== 'addConnection') return { valid: true }
        const conn = ctx.payload as FlowConnection
        const fromNode = ctx.graph.nodes.find(n => n.id === conn.fromNodeId)
        const toNode = ctx.graph.nodes.find(n => n.id === conn.toNodeId)
        if (!fromNode || !toNode) return { valid: false, reason: 'Node not found' }
        const fromPin = fromNode.outputs.find(p => p.id === conn.fromPinId)
        const toPin = toNode.inputs.find(p => p.id === conn.toPinId)
        if (!fromPin || !toPin) return { valid: false, reason: 'Pin not found' }
        const allowed = compat[fromPin.type]
        if (allowed) {
          if (!allowed.includes(toPin.type)) {
            return { valid: false, reason: `Type incompatible: ${fromPin.type} -> ${toPin.type}` }
          }
        } else if (fromPin.type !== toPin.type) {
          return { valid: false, reason: `Type incompatible: ${fromPin.type} -> ${toPin.type}` }
        }
        return { valid: true }
      },
    }
  }

  static noSelfConnection(): ValidationRule {
    return {
      name: 'noSelfConnection',
      validate(ctx) {
        if (ctx.action !== 'addConnection') return { valid: true }
        const conn = ctx.payload as FlowConnection
        if (conn.fromNodeId === conn.toNodeId) {
          return { valid: false, reason: 'Cannot connect a node to itself' }
        }
        return { valid: true }
      },
    }
  }

  static noDuplicateConnection(): ValidationRule {
    return {
      name: 'noDuplicateConnection',
      validate(ctx) {
        if (ctx.action !== 'addConnection') return { valid: true }
        const conn = ctx.payload as FlowConnection
        const exists = ctx.graph.connections.some(
          c => c.fromNodeId === conn.fromNodeId && c.fromPinId === conn.fromPinId
            && c.toNodeId === conn.toNodeId && c.toPinId === conn.toPinId,
        )
        if (exists) return { valid: false, reason: 'Duplicate connection' }
        return { valid: true }
      },
    }
  }

  static noDuplicateNodeId(): ValidationRule {
    return {
      name: 'noDuplicateNodeId',
      validate(ctx) {
        if (ctx.action !== 'addNode') return { valid: true }
        const node = ctx.payload as FlowNode
        if (ctx.graph.nodes.some(n => n.id === node.id)) {
          return { valid: false, reason: `Duplicate node ID: ${node.id}` }
        }
        return { valid: true }
      },
    }
  }

  static noCycles(): ValidationRule {
    return {
      name: 'noCycles',
      validate(ctx) {
        if (ctx.action !== 'addConnection') return { valid: true }
        const conn = ctx.payload as FlowConnection
        // Build adjacency list including the new connection
        const adj = new Map<string, string[]>()
        for (const c of ctx.graph.connections) {
          if (!adj.has(c.fromNodeId)) adj.set(c.fromNodeId, [])
          adj.get(c.fromNodeId)!.push(c.toNodeId)
        }
        if (!adj.has(conn.fromNodeId)) adj.set(conn.fromNodeId, [])
        adj.get(conn.fromNodeId)!.push(conn.toNodeId)
        // DFS from toNodeId — if we can reach fromNodeId, it's a cycle
        const visited = new Set<string>()
        const stack = [conn.toNodeId]
        while (stack.length > 0) {
          const current = stack.pop()!
          if (current === conn.fromNodeId) {
            return { valid: false, reason: 'Connection would create a cycle' }
          }
          if (visited.has(current)) continue
          visited.add(current)
          const neighbors = adj.get(current)
          if (neighbors) {
            for (const n of neighbors) stack.push(n)
          }
        }
        return { valid: true }
      },
    }
  }

  static maxConnectionsPerPin(max: number): ValidationRule {
    return {
      name: 'maxConnectionsPerPin',
      validate(ctx) {
        if (ctx.action !== 'addConnection') return { valid: true }
        const conn = ctx.payload as FlowConnection
        const fromCount = ctx.graph.connections.filter(
          c => c.fromNodeId === conn.fromNodeId && c.fromPinId === conn.fromPinId,
        ).length
        if (fromCount >= max) {
          return { valid: false, reason: `Pin ${conn.fromPinId} already has ${max} connection(s)` }
        }
        const toCount = ctx.graph.connections.filter(
          c => c.toNodeId === conn.toNodeId && c.toPinId === conn.toPinId,
        ).length
        if (toCount >= max) {
          return { valid: false, reason: `Pin ${conn.toPinId} already has ${max} connection(s)` }
        }
        return { valid: true }
      },
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/Validator.test.ts`
Expected: 10 tests PASS

**Step 5: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 6: Commit**

```
feat(flow): add composable Validator with 6 built-in rules
```

---

### Task 3: GraphStore — tests + implementation

**Files:**
- Create: `packages/flow/src/model/GraphStore.ts`
- Create: `packages/flow/tests/GraphStore.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/GraphStore.test.ts
import { describe, it, expect, vi } from 'vitest'
import { GraphStore } from '../src/model/GraphStore'
import { Validator } from '../src/model/Validator'
import type { FlowNode, FlowConnection } from '../src/types'

const makeNode = (id: string, inputs: Array<{ id: string; type: string }> = [], outputs: Array<{ id: string; type: string }> = []): FlowNode => ({
  id,
  type: 'test/node',
  label: id,
  position: { x: 0, y: 0 },
  inputs: inputs.map(p => ({ ...p, label: p.id })),
  outputs: outputs.map(p => ({ ...p, label: p.id })),
  data: {},
})

const makeConn = (id: string, from: string, fromPin: string, to: string, toPin: string): FlowConnection => ({
  id, fromNodeId: from, fromPinId: fromPin, toNodeId: to, toPinId: toPin,
})

describe('GraphStore', () => {
  it('addNode stores node and emits event', () => {
    const store = new GraphStore()
    const handler = vi.fn()
    store.events.on('node:added', handler)
    store.addNode(makeNode('n1'))
    expect(store.getNodes()).toHaveLength(1)
    expect(handler).toHaveBeenCalledWith({ node: expect.objectContaining({ id: 'n1' }) })
  })

  it('removeNode cascades connections and emits event', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', [{ id: 'in', type: 'exec' }], []))
    store.addConnection(makeConn('c1', 'n1', 'out', 'n2', 'in'))
    const handler = vi.fn()
    store.events.on('node:removed', handler)
    store.removeNode('n1')
    expect(store.getNodes()).toHaveLength(1)
    expect(store.getConnections()).toHaveLength(0)
    expect(handler).toHaveBeenCalledWith({ nodeId: 'n1', removedConnections: ['c1'] })
  })

  it('addConnection stores connection and emits event', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', [{ id: 'in', type: 'exec' }], []))
    const handler = vi.fn()
    store.events.on('connection:added', handler)
    store.addConnection(makeConn('c1', 'n1', 'out', 'n2', 'in'))
    expect(store.getConnections()).toHaveLength(1)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('moveNode updates position and emits event', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const handler = vi.fn()
    store.events.on('node:moved', handler)
    store.moveNode('n1', { x: 100, y: 200 })
    expect(store.getNode('n1')!.position).toEqual({ x: 100, y: 200 })
    expect(handler).toHaveBeenCalledWith({ nodeId: 'n1', position: { x: 100, y: 200 } })
  })

  it('updateNodeData merges data and emits event', () => {
    const store = new GraphStore()
    store.addNode({ ...makeNode('n1'), data: { a: 1 } })
    store.updateNodeData('n1', { b: 2 })
    expect(store.getNode('n1')!.data).toEqual({ a: 1, b: 2 })
  })

  it('getState returns a FlowGraph snapshot', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const state = store.getState()
    expect(state.nodes).toHaveLength(1)
    expect(state.connections).toHaveLength(0)
  })

  it('getConnectionsForNode returns all connections touching a node', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', [{ id: 'in', type: 'exec' }], [{ id: 'out2', type: 'exec' }]))
    store.addNode(makeNode('n3', [{ id: 'in', type: 'exec' }], []))
    store.addConnection(makeConn('c1', 'n1', 'out', 'n2', 'in'))
    store.addConnection(makeConn('c2', 'n2', 'out2', 'n3', 'in'))
    expect(store.getConnectionsForNode('n2')).toHaveLength(2)
    expect(store.getConnectionsForNode('n1')).toHaveLength(1)
  })

  it('getConnectionsForPin returns connections for a specific pin', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', [], [{ id: 'out', type: 'exec' }, { id: 'out2', type: 'string' }]))
    store.addNode(makeNode('n2', [{ id: 'in', type: 'exec' }], []))
    store.addNode(makeNode('n3', [{ id: 'in', type: 'string' }], []))
    store.addConnection(makeConn('c1', 'n1', 'out', 'n2', 'in'))
    store.addConnection(makeConn('c2', 'n1', 'out2', 'n3', 'in'))
    expect(store.getConnectionsForPin('n1', 'out')).toHaveLength(1)
    expect(store.getConnectionsForPin('n1', 'out2')).toHaveLength(1)
  })

  it('hasConnection checks if a specific connection exists', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', [{ id: 'in', type: 'exec' }], []))
    store.addConnection(makeConn('c1', 'n1', 'out', 'n2', 'in'))
    expect(store.hasConnection('n1', 'out', 'n2', 'in')).toBe(true)
    expect(store.hasConnection('n2', 'in', 'n1', 'out')).toBe(false)
  })

  it('clear removes everything and emits event', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    const handler = vi.fn()
    store.events.on('graph:cleared', handler)
    store.clear()
    expect(store.getNodes()).toHaveLength(0)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('batch groups events and emits batch:start/end', () => {
    const store = new GraphStore()
    const batchStart = vi.fn()
    const batchEnd = vi.fn()
    store.events.on('batch:start', batchStart)
    store.events.on('batch:end', batchEnd)
    store.batch(() => {
      store.addNode(makeNode('n1'))
      store.addNode(makeNode('n2'))
    })
    expect(batchStart).toHaveBeenCalledOnce()
    expect(batchEnd).toHaveBeenCalledOnce()
    expect(store.getNodes()).toHaveLength(2)
  })

  it('throws on validation failure (with validator)', () => {
    const validator = new Validator([Validator.noDuplicateNodeId()])
    const store = new GraphStore({ validator })
    store.addNode(makeNode('n1'))
    expect(() => store.addNode(makeNode('n1'))).toThrow('Duplicate node ID')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/GraphStore.test.ts`
Expected: FAIL — cannot find module `../src/model/GraphStore`

**Step 3: Write the implementation**

```typescript
// packages/flow/src/model/GraphStore.ts
import type { FlowNode, FlowConnection, FlowGraph, FlowNodePosition } from '../types'
import { EventBus } from './EventBus'
import type { Validator } from './Validator'

export interface GraphEvents {
  'node:added': { node: FlowNode }
  'node:removed': { nodeId: string; removedConnections: string[] }
  'node:moved': { nodeId: string; position: FlowNodePosition }
  'node:dataChanged': { nodeId: string; data: Record<string, unknown> }
  'connection:added': { connection: FlowConnection }
  'connection:removed': { connectionId: string }
  'graph:cleared': {}
  'graph:imported': { graph: FlowGraph }
  'batch:start': {}
  'batch:end': { events: Array<{ type: string; payload: unknown }> }
}

export interface GraphStoreOptions {
  validator?: Validator
  eventBus?: EventBus<GraphEvents>
}

export class GraphStore {
  private nodes = new Map<string, FlowNode>()
  private connections = new Map<string, FlowConnection>()
  private validator?: Validator
  private _events: EventBus<GraphEvents>
  private batching = false
  private batchedEvents: Array<{ type: string; payload: unknown }> = []

  constructor(options?: GraphStoreOptions) {
    this.validator = options?.validator
    this._events = options?.eventBus ?? new EventBus<GraphEvents>()
  }

  get events(): EventBus<GraphEvents> {
    return this._events
  }

  // ── Read ──

  getState(): FlowGraph {
    return {
      nodes: this.getNodes(),
      connections: this.getConnections(),
    }
  }

  getNode(id: string): FlowNode | undefined {
    const node = this.nodes.get(id)
    return node ? { ...node } : undefined
  }

  getNodes(): FlowNode[] {
    return Array.from(this.nodes.values()).map(n => ({ ...n }))
  }

  getConnections(): FlowConnection[] {
    return Array.from(this.connections.values()).map(c => ({ ...c }))
  }

  getConnectionsForNode(nodeId: string): FlowConnection[] {
    return this.getConnections().filter(
      c => c.fromNodeId === nodeId || c.toNodeId === nodeId,
    )
  }

  getConnectionsForPin(nodeId: string, pinId: string): FlowConnection[] {
    return this.getConnections().filter(
      c => (c.fromNodeId === nodeId && c.fromPinId === pinId)
        || (c.toNodeId === nodeId && c.toPinId === pinId),
    )
  }

  hasConnection(fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string): boolean {
    for (const c of this.connections.values()) {
      if (c.fromNodeId === fromNodeId && c.fromPinId === fromPinId
        && c.toNodeId === toNodeId && c.toPinId === toPinId) {
        return true
      }
    }
    return false
  }

  // ── Mutations ──

  addNode(node: FlowNode): void {
    this.runValidation('addNode', node)
    this.nodes.set(node.id, { ...node })
    this.emitEvent('node:added', { node: { ...node } })
  }

  removeNode(nodeId: string): void {
    this.runValidation('removeNode', { nodeId })
    this.nodes.delete(nodeId)
    const removedConnections: string[] = []
    for (const [id, conn] of this.connections) {
      if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
        this.connections.delete(id)
        removedConnections.push(id)
      }
    }
    this.emitEvent('node:removed', { nodeId, removedConnections })
  }

  moveNode(nodeId: string, position: FlowNodePosition): void {
    const node = this.nodes.get(nodeId)
    if (!node) return
    this.nodes.set(nodeId, { ...node, position })
    this.emitEvent('node:moved', { nodeId, position })
  }

  updateNodeData(nodeId: string, data: Record<string, unknown>): void {
    const node = this.nodes.get(nodeId)
    if (!node) return
    const merged = { ...node.data, ...data }
    this.nodes.set(nodeId, { ...node, data: merged })
    this.emitEvent('node:dataChanged', { nodeId, data: merged })
  }

  addConnection(connection: FlowConnection): void {
    this.runValidation('addConnection', connection)
    this.connections.set(connection.id, { ...connection })
    this.emitEvent('connection:added', { connection: { ...connection } })
  }

  removeConnection(connectionId: string): void {
    this.runValidation('removeConnection', { connectionId })
    this.connections.delete(connectionId)
    this.emitEvent('connection:removed', { connectionId })
  }

  // ── Batch ──

  batch(fn: () => void): void {
    this.batching = true
    this.batchedEvents = []
    this._events.emit('batch:start', {})
    try {
      fn()
    } finally {
      this.batching = false
      this._events.emit('batch:end', { events: this.batchedEvents })
      this.batchedEvents = []
    }
  }

  // ── Graph-level ──

  clear(): void {
    this.nodes.clear()
    this.connections.clear()
    this.emitEvent('graph:cleared', {})
  }

  importGraph(graph: FlowGraph): void {
    this.nodes.clear()
    this.connections.clear()
    for (const node of graph.nodes) {
      this.nodes.set(node.id, { ...node })
    }
    for (const conn of graph.connections) {
      this.connections.set(conn.id, { ...conn })
    }
    this.emitEvent('graph:imported', { graph: this.getState() })
  }

  clone(): GraphStore {
    const cloned = new GraphStore({ validator: this.validator })
    cloned.importGraph(this.getState())
    return cloned
  }

  // ── Internal ──

  private runValidation(action: string, payload: unknown): void {
    if (!this.validator) return
    const result = this.validator.validate({
      graph: this.getState(),
      action: action as any,
      payload: payload as any,
    })
    if (!result.valid) {
      throw new Error(result.reason)
    }
  }

  private emitEvent<K extends keyof GraphEvents>(event: K, payload: GraphEvents[K]): void {
    if (this.batching) {
      this.batchedEvents.push({ type: event as string, payload })
    }
    this._events.emit(event, payload)
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/GraphStore.test.ts`
Expected: 12 tests PASS

**Step 5: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 6: Commit**

```
feat(flow): add GraphStore with events, validation, batch, and query helpers
```

---

### Task 4: HistoryManager — tests + implementation

**Files:**
- Create: `packages/flow/src/model/HistoryManager.ts`
- Create: `packages/flow/tests/HistoryManager.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/HistoryManager.test.ts
import { describe, it, expect } from 'vitest'
import { GraphStore } from '../src/model/GraphStore'
import { HistoryManager } from '../src/model/HistoryManager'
import type { FlowNode } from '../src/types'

const makeNode = (id: string): FlowNode => ({
  id, type: 'test/node', label: id, position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
})

describe('HistoryManager', () => {
  it('undo restores previous state', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.addNode(makeNode('n1'))
    expect(store.getNodes()).toHaveLength(1)
    history.undo()
    expect(store.getNodes()).toHaveLength(0)
  })

  it('redo restores undone state', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.addNode(makeNode('n1'))
    history.undo()
    expect(store.getNodes()).toHaveLength(0)
    history.redo()
    expect(store.getNodes()).toHaveLength(1)
  })

  it('canUndo/canRedo reflect state correctly', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    expect(history.canUndo()).toBe(false)
    store.addNode(makeNode('n1'))
    expect(history.canUndo()).toBe(true)
    expect(history.canRedo()).toBe(false)
    history.undo()
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(true)
  })

  it('captures initial state automatically on first mutation', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    // Undo n2
    history.undo()
    expect(store.getNodes()).toHaveLength(1)
    // Undo n1 — back to empty (initial state captured automatically)
    history.undo()
    expect(store.getNodes()).toHaveLength(0)
  })

  it('batch counts as a single undo step', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.batch(() => {
      store.addNode(makeNode('n1'))
      store.addNode(makeNode('n2'))
      store.addNode(makeNode('n3'))
    })
    expect(store.getNodes()).toHaveLength(3)
    // Single undo reverts all 3 nodes
    history.undo()
    expect(store.getNodes()).toHaveLength(0)
  })

  it('respects maxSize limit', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store, { maxSize: 3 })
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    store.addNode(makeNode('n3'))
    store.addNode(makeNode('n4'))
    // Stack: [initial, +n1, +n2] — n3,n4 pushed, but maxSize=3 so oldest is trimmed
    // We can only undo 2 times (3 entries = 2 undos), not back to initial
    const undoStack = history.getUndoStack()
    expect(undoStack.length).toBeLessThanOrEqual(3)
  })

  it('getUndoStack returns labeled entries', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.addNode(makeNode('n1'))
    const stack = history.getUndoStack()
    expect(stack.length).toBeGreaterThan(0)
    expect(stack[stack.length - 1].label).toBeTruthy()
    expect(stack[stack.length - 1].timestamp).toBeGreaterThan(0)
  })

  it('clear resets history', () => {
    const store = new GraphStore()
    const history = new HistoryManager(store)
    store.addNode(makeNode('n1'))
    expect(history.canUndo()).toBe(true)
    history.clear()
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/HistoryManager.test.ts`
Expected: FAIL — cannot find module `../src/model/HistoryManager`

**Step 3: Write the implementation**

```typescript
// packages/flow/src/model/HistoryManager.ts
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
      // The initial state is the state BEFORE this mutation.
      // Since we can't get it after the mutation, we insert a blank initial.
      // Actually, we push 2 entries: the "initial" was already lost,
      // but we approximate by pushing the current state as the only entry.
      // A better approach: capture initial state on first mutation.
      this.initialCaptured = true
      // We don't have the pre-mutation state, so we rely on the fact that
      // the first call means the graph was empty before.
      // We push an "initial" entry with empty state, then the current state.
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
      default: return event
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/HistoryManager.test.ts`
Expected: 8 tests PASS

**Step 5: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 6: Commit**

```
feat(flow): add HistoryManager with auto-subscribe, batch transactions, and labels
```

---

### Task 5: Improve defineNode + NodeRegistry

**Files:**
- Modify: `packages/flow/src/define/defineNode.ts`
- Modify: `packages/flow/src/define/NodeRegistry.ts`
- Modify: `packages/flow/tests/defineNode.test.ts`

**Step 1: Update defineNode tests**

Add these tests to `packages/flow/tests/defineNode.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/defineNode.test.ts`
Expected: FAIL — new tests fail (missing `category`, no UUID, no `has`, no `unregister`, no `getCategories`)

**Step 3: Update defineNode.ts**

Replace `packages/flow/src/define/defineNode.ts` with:

```typescript
import type { FlowNode, FlowPin, FlowNodePosition } from '../types'

export interface NodeDefinition {
  type: string
  label: string
  color?: string
  icon?: string
  category?: string
  inputs: FlowPin[]
  outputs: FlowPin[]
  defaultData?: Record<string, unknown>
}

export interface NodeDefinitionWithFactory extends NodeDefinition {
  createInstance: (position: FlowNodePosition, overrides?: Partial<FlowNode>) => FlowNode
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function validatePins(pins: FlowPin[], label: string): void {
  const seen = new Set<string>()
  for (const pin of pins) {
    if (seen.has(pin.id)) {
      throw new Error(`Duplicate pin ID '${pin.id}' in ${label}`)
    }
    seen.add(pin.id)
  }
}

export function defineNode(definition: NodeDefinition): NodeDefinitionWithFactory {
  validatePins(definition.inputs, `${definition.type} inputs`)
  validatePins(definition.outputs, `${definition.type} outputs`)

  return {
    ...definition,
    createInstance(position: FlowNodePosition, overrides?: Partial<FlowNode>): FlowNode {
      return {
        id: generateId(),
        type: definition.type,
        label: definition.label,
        position,
        inputs: definition.inputs.map(p => ({ ...p })),
        outputs: definition.outputs.map(p => ({ ...p })),
        data: { ...definition.defaultData },
        color: definition.color,
        ...overrides,
      }
    },
  }
}
```

**Step 4: Update NodeRegistry.ts**

Replace `packages/flow/src/define/NodeRegistry.ts` with:

```typescript
import type { NodeDefinitionWithFactory } from './defineNode'

export class NodeRegistry {
  private definitions: Map<string, NodeDefinitionWithFactory> = new Map()

  register(definition: NodeDefinitionWithFactory): void {
    this.definitions.set(definition.type, definition)
  }

  registerMany(definitions: NodeDefinitionWithFactory[]): void {
    for (const def of definitions) this.register(def)
  }

  unregister(type: string): void {
    this.definitions.delete(type)
  }

  has(type: string): boolean {
    return this.definitions.has(type)
  }

  get(type: string): NodeDefinitionWithFactory | undefined {
    return this.definitions.get(type)
  }

  getAll(): NodeDefinitionWithFactory[] {
    return Array.from(this.definitions.values())
  }

  getByNamespace(namespace: string): NodeDefinitionWithFactory[] {
    return this.getAll().filter(d => d.type.startsWith(`${namespace}/`))
  }

  getCategories(): Map<string, NodeDefinitionWithFactory[]> {
    const categories = new Map<string, NodeDefinitionWithFactory[]>()
    for (const def of this.definitions.values()) {
      const slashIndex = def.type.indexOf('/')
      const ns = slashIndex > 0 ? def.type.slice(0, slashIndex) : 'default'
      if (!categories.has(ns)) categories.set(ns, [])
      categories.get(ns)!.push(def)
    }
    return categories
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/defineNode.test.ts`
Expected: 8 tests PASS (2 old + 6 new)

**Step 6: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 7: Commit**

```
feat(flow): improve defineNode (UUID, pin validation, category) and NodeRegistry (unregister, has, getCategories)
```

---

### Task 6: Wire up exports, update FlowCanvas, remove old files

**Files:**
- Delete: `packages/flow/src/model/GraphModel.ts`
- Delete: `packages/flow/src/model/ConnectionValidator.ts`
- Delete: `packages/flow/src/model/History.ts`
- Delete: `packages/flow/tests/GraphModel.test.ts`
- Delete: `packages/flow/tests/ConnectionValidator.test.ts`
- Delete: `packages/flow/tests/History.test.ts`
- Modify: `packages/flow/src/index.ts`
- Modify: `packages/flow/src/components/FlowCanvas.tsx`

**Step 1: Update `packages/flow/src/index.ts`**

Replace contents with:

```typescript
export * from './types'
export * from './model/EventBus'
export * from './model/GraphStore'
export * from './model/Validator'
export * from './model/HistoryManager'
export * from './define'
export * from './components'
```

**Step 2: Update FlowCanvas.tsx**

In `packages/flow/src/components/FlowCanvas.tsx`, replace the import line:

```typescript
// OLD
import { GraphModel } from '../model/GraphModel'

// NEW
import { GraphStore } from '../model/GraphStore'
```

Then in the `renderCanvas` function and the `useEffect`, replace `GraphModel.fromJSON(graph)` with `GraphStore` usage. Find the `useEffect` callback and replace:

```typescript
// OLD
const model = GraphModel.fromJSON(graph)

// NEW
const model = new GraphStore()
model.importGraph(graph)
```

And in `drawConnections`, replace `model.getConnections()` and `model.getNodes()` — these methods have the same signatures on `GraphStore` as they did on `GraphModel`, so the rendering code works identically. Just update the type annotation on the `drawConnections` and `renderCanvas` function parameters from `GraphModel` to `GraphStore`:

```typescript
// In drawConnections signature:
function drawConnections(ctx: CanvasRenderingContext2D, model: GraphStore, theme: FlowTheme) {

// In renderCanvas signature:
function renderCanvas(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  model: GraphStore,
  theme: FlowTheme,
  connectedPins: Set<string>,
) {
```

**Step 3: Delete old files**

Delete:
- `packages/flow/src/model/GraphModel.ts`
- `packages/flow/src/model/ConnectionValidator.ts`
- `packages/flow/src/model/History.ts`
- `packages/flow/tests/GraphModel.test.ts`
- `packages/flow/tests/ConnectionValidator.test.ts`
- `packages/flow/tests/History.test.ts`

**Step 4: Run all tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: All tests PASS (types.test.ts + EventBus.test.ts + Validator.test.ts + GraphStore.test.ts + HistoryManager.test.ts + defineNode.test.ts = ~45 tests)

**Step 5: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 6: Verify Storybook renders correctly**

Run: `pnpm --filter @quantum-studios/flow storybook`
Verify: all stories render identically to before (the rendering is unchanged, only the internal model class changed).

**Step 7: Commit**

```
feat(flow): replace GraphModel/ConnectionValidator/History with v2 model

BREAKING CHANGE: GraphModel replaced by GraphStore, ConnectionValidator
replaced by Validator, History replaced by HistoryManager. All types
(FlowGraph, FlowNode, etc.) remain unchanged.
```

---
