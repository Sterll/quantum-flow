# Model Reference

Complete API reference for the core model classes exported by `@quantum-studios/flow`. These classes can be used independently of React.

## GraphStore {#graphstore}

The single source of truth for graph state. Holds all nodes and connections, validates mutations, and emits typed events through its `EventBus`.

### Import

```typescript
import { GraphStore } from '@quantum-studios/flow'
```

### Constructor

```typescript
class GraphStore {
  constructor(options?: {
    validator?: Validator
    eventBus?: EventBus<GraphEvents>
  })
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `validator` | `Validator` | `undefined` | Validation rules applied before `addNode`, `removeNode`, `addConnection`, `removeConnection` |
| `eventBus` | `EventBus<GraphEvents>` | `new EventBus()` | Custom event bus instance (advanced -- most users should omit this) |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `events` | `EventBus<GraphEvents>` | The event bus that emits mutation events. Read-only getter. |

### Methods

#### State Queries

| Method | Signature | Description |
|--------|-----------|-------------|
| `getState()` | `() => FlowGraph` | Returns a snapshot of the full graph (nodes + connections) |
| `getNode(id)` | `(id: string) => FlowNode \| undefined` | Look up a node by ID |
| `getNodes()` | `() => FlowNode[]` | Returns copies of all nodes |
| `getConnections()` | `() => FlowConnection[]` | Returns copies of all connections |
| `getConnectionsForNode(nodeId)` | `(nodeId: string) => FlowConnection[]` | All connections where `fromNodeId` or `toNodeId` matches |
| `getConnectionsForPin(nodeId, pinId)` | `(nodeId: string, pinId: string) => FlowConnection[]` | Connections on a specific pin |
| `hasConnection(fromNodeId, fromPinId, toNodeId, toPinId)` | `(fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string) => boolean` | Check if a specific connection exists |

#### Mutations

| Method | Signature | Description |
|--------|-----------|-------------|
| `addNode(node)` | `(node: FlowNode) => void` | Add a node. Emits `node:added`. Validated. |
| `removeNode(nodeId)` | `(nodeId: string) => void` | Remove a node and all its connections. Emits `node:removed`. Validated. |
| `moveNode(nodeId, position)` | `(nodeId: string, position: FlowNodePosition) => void` | Update a node's position. Emits `node:moved`. Not validated. |
| `updateNodeData(nodeId, data)` | `(nodeId: string, data: Record<string, unknown>) => void` | Merge data into a node's `data` object. Emits `node:dataChanged`. Not validated. |
| `addConnection(connection)` | `(connection: FlowConnection) => void` | Create a connection. Emits `connection:added`. Validated. |
| `removeConnection(connectionId)` | `(connectionId: string) => void` | Remove a connection. Emits `connection:removed`. Validated. |

#### Batch and Lifecycle

| Method | Signature | Description |
|--------|-----------|-------------|
| `batch(fn)` | `(fn: () => void) => void` | Group multiple mutations into a single history entry. Emits `batch:start` and `batch:end`. |
| `clear()` | `() => void` | Remove all nodes and connections. Emits `graph:cleared`. |
| `importGraph(graph)` | `(graph: FlowGraph) => void` | Replace the entire graph atomically. Emits `graph:imported`. |
| `clone()` | `() => GraphStore` | Create a deep copy of the store (without the validator) |

### Example

```typescript
const store = new GraphStore({ validator: new Validator([Validator.noSelfConnection()]) })

store.addNode({
  id: 'n1', type: 'math/add', label: 'Add', position: { x: 0, y: 0 },
  inputs: [{ id: 'a', type: 'number', label: 'A' }],
  outputs: [{ id: 'result', type: 'number', label: 'Result' }],
  data: {},
})

store.events.on('node:added', ({ node }) => console.log('Added:', node.label))
```

---

## EventBus {#eventbus}

A typed publish/subscribe system. `GraphStore` owns an `EventBus<GraphEvents>` instance that emits events on every mutation.

### Import

```typescript
import { EventBus } from '@quantum-studios/flow'
```

### Constructor

```typescript
class EventBus<Events> {
  constructor()
}
```

The generic parameter `Events` is a map of event names to their payload types (e.g., `GraphEvents`).

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `on(event, handler)` | `<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void) => () => void` | Subscribe to an event. Returns an unsubscribe function. |
| `off(event, handler)` | `<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void) => void` | Unsubscribe a specific handler by reference |
| `emit(event, payload)` | `<K extends keyof Events>(event: K, payload: Events[K]) => void` | Emit an event to all subscribers |
| `once(event, handler)` | `<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void) => () => void` | Subscribe for a single emission only. Returns an unsubscribe function. |

### Example

```typescript
const bus = new EventBus<GraphEvents>()

const unsub = bus.on('node:added', ({ node }) => console.log(node.label))
bus.once('graph:cleared', () => console.log('Graph was cleared'))

unsub() // unsubscribe
```

---

## Validator {#validator}

Runs a composable list of validation rules before every validated mutation. If any rule fails, the mutation throws an `Error` and the graph remains unchanged.

### Import

```typescript
import { Validator } from '@quantum-studios/flow'
```

### Constructor

```typescript
class Validator {
  constructor(rules?: ValidationRule[])
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `rules` | `ValidationRule[]` | `[]` | Initial set of validation rules |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `addRule(rule)` | `(rule: ValidationRule) => void` | Add a validation rule |
| `removeRule(name)` | `(name: string) => void` | Remove a rule by its `name` property |
| `validate(context)` | `(context: ValidationContext) => ValidationResult` | Run all rules against a context. Returns the first failure, or `{ valid: true }`. |

### Static Factory Methods

These methods return pre-built `ValidationRule` objects for common constraints.

| Method | Signature | Description |
|--------|-----------|-------------|
| `Validator.typeCompatibility(overrides?)` | `(overrides?: Record<string, string[]>) => ValidationRule` | Prevent connecting pins of incompatible types. Optional `overrides` map allows custom type conversions (e.g., `{ number: ['number', 'string'] }`). |
| `Validator.noSelfConnection()` | `() => ValidationRule` | Prevent connecting a node to itself |
| `Validator.noDuplicateConnection()` | `() => ValidationRule` | Prevent creating the same connection twice |
| `Validator.noDuplicateNodeId()` | `() => ValidationRule` | Prevent adding a node with an ID that already exists |
| `Validator.noCycles()` | `() => ValidationRule` | Prevent creating cycles in the graph |
| `Validator.maxConnectionsPerPin(max)` | `(max: number) => ValidationRule` | Limit the number of connections per pin |

### Example

```typescript
const validator = new Validator([
  Validator.noSelfConnection(),
  Validator.noDuplicateConnection(),
  Validator.typeCompatibility(),
  Validator.maxConnectionsPerPin(1),
])

validator.addRule(Validator.noCycles())
validator.removeRule('noCycles')
```

### Custom Rules

```typescript
const maxNodes: ValidationRule = {
  name: 'maxNodes',
  validate(context) {
    if (context.action !== 'addNode') return { valid: true }
    return context.graph.nodes.length >= 50
      ? { valid: false, reason: 'Maximum of 50 nodes reached' }
      : { valid: true }
  },
}
validator.addRule(maxNodes)
```

::: warning
Validation only runs for `addNode`, `addConnection`, `removeNode`, and `removeConnection`. Operations like `moveNode` and `updateNodeData` bypass validation because they cannot violate graph integrity.
:::

---

## HistoryManager {#historymanager}

Provides undo/redo by automatically subscribing to `GraphStore` events and capturing graph snapshots.

### Import

```typescript
import { HistoryManager } from '@quantum-studios/flow'
```

### Constructor

```typescript
class HistoryManager {
  constructor(store: GraphStore, options?: { maxSize?: number })
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `store` | `GraphStore` | **required** | The graph store to track |
| `options.maxSize` | `number` | `50` | Maximum number of entries in the undo stack. Oldest entries are discarded when exceeded. |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `undo()` | `() => boolean` | Undo the last action. Returns `true` if an entry was restored, `false` if the stack is empty. |
| `redo()` | `() => boolean` | Redo the last undone action. Returns `true` if an entry was restored, `false` if the stack is empty. |
| `canUndo()` | `() => boolean` | Whether the undo stack has entries |
| `canRedo()` | `() => boolean` | Whether the redo stack has entries |
| `clear()` | `() => void` | Clear both undo and redo stacks |
| `getUndoStack()` | `() => Array<{ label: string; timestamp: number }>` | Inspect the undo stack. Each entry has a human-readable label and a Unix timestamp. |
| `getRedoStack()` | `() => Array<{ label: string; timestamp: number }>` | Inspect the redo stack. Each entry has a human-readable label and a Unix timestamp. |

### Auto-generated Labels

Each history entry receives a label derived from the event type:

| Event | Label Example |
|-------|--------------|
| `node:added` | `"Added node 'Add'"` |
| `node:removed` | `"Removed node 'node-1'"` |
| `node:moved` | `"Moved node 'node-1'"` |
| `connection:added` | `"Connected node-1 -> node-2"` |
| `graph:cleared` | `"Cleared graph"` |
| Batch | `"Batch operation"` |

### Example

```typescript
const store = new GraphStore()
const history = new HistoryManager(store, { maxSize: 100 })

// After mutations...
history.undo()
history.redo()
console.log(history.getUndoStack().map(e => e.label))
```

---

## NodeRegistry {#noderegistry}

A catalog of reusable node type definitions. Definitions are registered via `register()` or `registerMany()` and queried by type string, namespace, or category.

### Import

```typescript
import { NodeRegistry } from '@quantum-studios/flow'
```

### Constructor

```typescript
class NodeRegistry {
  constructor()
}
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `register(definition)` | `(definition: NodeDefinitionWithFactory) => void` | Register a single node definition |
| `registerMany(definitions)` | `(definitions: NodeDefinitionWithFactory[]) => void` | Register multiple definitions at once |
| `unregister(type)` | `(type: string) => void` | Remove a definition by its type string |
| `has(type)` | `(type: string) => boolean` | Check if a type is registered |
| `get(type)` | `(type: string) => NodeDefinitionWithFactory \| undefined` | Get a definition by type, or `undefined` if not found |
| `getAll()` | `() => NodeDefinitionWithFactory[]` | Get all registered definitions |
| `getByNamespace(namespace)` | `(namespace: string) => NodeDefinitionWithFactory[]` | Get definitions whose type starts with `namespace/` |
| `getCategories()` | `() => Map<string, NodeDefinitionWithFactory[]>` | Group definitions by their `category` field |

### Namespace Convention

The namespace is derived from the part of the `type` string before the first `/`. A type of `"math/add"` belongs to the `"math"` namespace. Types without a `/` fall into the `"default"` namespace.

### Example

```typescript
import { NodeRegistry, defineNode } from '@quantum-studios/flow'

const AddNode = defineNode({
  type: 'math/add', label: 'Add', category: 'Math',
  inputs: [{ id: 'a', type: 'number', label: 'A' }],
  outputs: [{ id: 'result', type: 'number', label: 'Result' }],
})

const registry = new NodeRegistry()
registry.register(AddNode)

registry.has('math/add')            // true
registry.get('math/add')            // AddNode
registry.getByNamespace('math')     // [AddNode]
registry.getCategories()            // Map { 'Math' => [AddNode] }
registry.unregister('math/add')     // removes it
```

---

## defineNode {#definenode}

A factory function that takes a `NodeDefinition` and returns a `NodeDefinitionWithFactory` with a `createInstance` method for stamping out `FlowNode` instances with unique UUIDs.

### Import

```typescript
import { defineNode } from '@quantum-studios/flow'
```

### Signature

```typescript
function defineNode(definition: NodeDefinition): NodeDefinitionWithFactory
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `definition` | [`NodeDefinition`](/api/types#nodedefinition) | The node blueprint |

### Return — `NodeDefinitionWithFactory`

See [`NodeDefinitionWithFactory`](/api/types#nodedefinitionwithfactory).

### Pin Validation

`defineNode` validates that pin IDs are unique within inputs and within outputs at definition time. Duplicate pin IDs throw an error immediately:

```typescript
// Throws: "Duplicate pin ID 'a' in math/broken inputs"
defineNode({
  type: 'math/broken',
  label: 'Broken',
  inputs: [
    { id: 'a', type: 'number', label: 'A' },
    { id: 'a', type: 'number', label: 'B' }, // duplicate
  ],
  outputs: [],
})
```

### Example

```typescript
const PrintNode = defineNode({
  type: 'io/print',
  label: 'Print',
  color: '#f472b6',
  category: 'I/O',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'message', type: 'string', label: 'Message' },
  ],
  outputs: [{ id: 'exec', type: 'exec', label: '' }],
})

const node = PrintNode.createInstance({ x: 100, y: 100 })
const custom = PrintNode.createInstance({ x: 200, y: 200 }, { label: 'Custom Print' })
```
