# Core Concepts

`@quantum-studios/flow` is a headless, Canvas 2D node editor for React. It is built around a small set of composable primitives that can be used independently or together through the high-level `useFlowEditor` hook.

## Architecture Overview

```
                  +-----------------+
                  |   NodeRegistry  |   defineNode() definitions
                  +--------+--------+
                           |
                           v
+----------+      +--------+--------+      +-------------+
| Validator | ---> |   GraphStore    | ---> |  EventBus   |
+----------+      +--------+--------+      +------+------+
                           |                       |
                           v                       v
                  +--------+--------+     +--------+--------+
                  | HistoryManager  |     |  React Hooks    |
                  +-----------------+     |  (useHistory,   |
                                          |  useClipboard)  |
                                          +--------+--------+
                                                   |
                                                   v
                                          +--------+--------+
                                          |   FlowCanvas    |
                                          +-----------------+
```

**Data flows top-down.** Mutations go through `GraphStore`, which validates them via `Validator`, stores the result, and emits typed events through `EventBus`. `HistoryManager` listens to those events to build undo/redo stacks. React hooks subscribe to the same events to trigger re-renders. `FlowCanvas` reads from the store on every animation frame to paint the 2D scene.

## GraphStore

`GraphStore` is the single source of truth. It holds the full graph state -- all nodes and all connections -- and exposes methods to mutate it.

```typescript
import { GraphStore } from '@quantum-studios/flow'

const store = new GraphStore()

store.addNode({
  id: 'node-1',
  type: 'math/add',
  label: 'Add',
  position: { x: 100, y: 200 },
  inputs: [
    { id: 'a', type: 'number', label: 'A' },
    { id: 'b', type: 'number', label: 'B' },
  ],
  outputs: [
    { id: 'result', type: 'number', label: 'Result' },
  ],
  data: {},
})
```

Every mutation emits a typed event. You can read the current state at any time:

```typescript
const graph = store.getState()    // { nodes: [...], connections: [...] }
const node  = store.getNode('node-1')
const conns = store.getConnectionsForNode('node-1')
```

### Key Properties

| Method | Description |
|--------|-------------|
| `getState()` | Returns a snapshot of the full graph (`FlowGraph`) |
| `getNodes()` / `getConnections()` | Returns copies of all nodes or connections |
| `getNode(id)` | Returns a single node by ID, or `undefined` |
| `getConnectionsForNode(nodeId)` | All connections touching a node |
| `getConnectionsForPin(nodeId, pinId)` | Connections on a specific pin |
| `hasConnection(from, fromPin, to, toPin)` | Checks if a specific connection exists |
| `addNode(node)` / `removeNode(id)` | Add or remove a node (connections are auto-removed) |
| `moveNode(id, position)` | Update node position |
| `updateNodeData(id, data)` | Merge new data into a node's `data` object |
| `addConnection(conn)` / `removeConnection(id)` | Add or remove a connection |
| `batch(fn)` | Group multiple mutations into a single history entry |
| `clear()` | Remove all nodes and connections |
| `importGraph(graph)` | Replace the entire graph |
| `clone()` | Create a deep copy of the store |

### Batch Operations

When you need to make several changes that should be treated as a single unit (e.g., for undo/redo), wrap them in `batch()`:

```typescript
store.batch(() => {
  store.addNode(nodeA)
  store.addNode(nodeB)
  store.addConnection(connection)
})
// HistoryManager captures this as one entry: "Batch operation"
```

::: tip
Inside a batch, individual events are still emitted (so the canvas repaints), but `HistoryManager` only captures a single snapshot when the batch ends.
:::

## EventBus

`EventBus` is a typed publish/subscribe system. `GraphStore` owns an `EventBus<GraphEvents>` instance that emits events on every mutation.

```typescript
const store = new GraphStore()

// Subscribe to node additions
const unsubscribe = store.events.on('node:added', ({ node }) => {
  console.log('New node:', node.label)
})

// Listen once
store.events.once('graph:imported', ({ graph }) => {
  console.log(`Imported ${graph.nodes.length} nodes`)
})

// Unsubscribe when done
unsubscribe()
```

### Available Events

| Event | Payload | Fires When |
|-------|---------|------------|
| `node:added` | `{ node }` | A node is added |
| `node:removed` | `{ nodeId, removedConnections }` | A node is removed (with its connections) |
| `node:moved` | `{ nodeId, position }` | A node changes position |
| `node:dataChanged` | `{ nodeId, data }` | A node's data is updated |
| `connection:added` | `{ connection }` | A connection is created |
| `connection:removed` | `{ connectionId }` | A connection is removed |
| `graph:cleared` | `{}` | The graph is cleared |
| `graph:imported` | `{ graph }` | A full graph is imported |
| `batch:start` | `{}` | A batch operation begins |
| `batch:end` | `{ events }` | A batch operation ends (includes all batched events) |

### EventBus API

| Method | Description |
|--------|-------------|
| `on(event, handler)` | Subscribe. Returns an `unsubscribe` function. |
| `off(event, handler)` | Unsubscribe by reference. |
| `once(event, handler)` | Subscribe for a single emission only. |
| `emit(event, payload)` | Emit an event (used internally by `GraphStore`). |

## Validator

`Validator` runs a composable list of rules before every mutation. If a rule fails, the mutation throws an `Error` and the graph remains unchanged.

```typescript
import { Validator, GraphStore } from '@quantum-studios/flow'

const validator = new Validator([
  Validator.noSelfConnection(),
  Validator.noDuplicateConnection(),
  Validator.typeCompatibility(),
  Validator.maxConnectionsPerPin(1),
])

const store = new GraphStore({ validator })
```

### Built-in Rules

| Rule | What it Prevents |
|------|-----------------|
| `Validator.noSelfConnection()` | Connecting a node to itself |
| `Validator.noDuplicateConnection()` | Creating the same connection twice |
| `Validator.typeCompatibility(overrides?)` | Connecting pins of incompatible types |
| `Validator.noDuplicateNodeId()` | Adding a node with an existing ID |
| `Validator.noCycles()` | Creating a cycle in the graph |
| `Validator.maxConnectionsPerPin(max)` | Exceeding `max` connections on a single pin |

::: warning
Validator rules only run for `addNode`, `addConnection`, `removeNode`, and `removeConnection` actions. Operations like `moveNode` and `updateNodeData` bypass validation because they cannot violate graph integrity.
:::

### Custom Rules

You can write your own `ValidationRule` to enforce domain-specific constraints:

```typescript
const maxNodesRule: ValidationRule = {
  name: 'maxNodes',
  validate(context) {
    if (context.action !== 'addNode') return { valid: true }
    if (context.graph.nodes.length >= 50) {
      return { valid: false, reason: 'Maximum of 50 nodes reached' }
    }
    return { valid: true }
  },
}

validator.addRule(maxNodesRule)
```

## HistoryManager

`HistoryManager` provides undo/redo by automatically subscribing to `GraphStore` events and capturing snapshots.

```typescript
import { GraphStore, HistoryManager } from '@quantum-studios/flow'

const store = new GraphStore()
const history = new HistoryManager(store, { maxSize: 100 })

// ... user makes changes ...

history.undo()  // Restores the previous state
history.redo()  // Re-applies the undone change
```

### How It Works

1. On construction, `HistoryManager` subscribes to all mutation events on the store's `EventBus`.
2. After each mutation, it captures a snapshot of the full graph and pushes it onto the undo stack.
3. When `undo()` is called, it restores the previous snapshot via `store.importGraph()`.
4. Performing a new mutation after an undo clears the redo stack (standard undo behavior).
5. Batch operations produce a single history entry instead of one per mutation.

### Auto-generated Labels

Each history entry has an automatic label derived from the event type:

| Event | Label Example |
|-------|--------------|
| `node:added` | `"Added node 'Add'"` |
| `node:removed` | `"Removed node 'node-1'"` |
| `node:moved` | `"Moved node 'node-1'"` |
| `connection:added` | `"Connected node-1 -> node-2"` |
| `graph:cleared` | `"Cleared graph"` |
| Batch | `"Batch operation"` (or the label of the first event) |

### Key Methods

| Method | Description |
|--------|-------------|
| `undo()` | Undo the last action. Returns `true` if successful. |
| `redo()` | Redo the last undone action. Returns `true` if successful. |
| `canUndo()` | Whether the undo stack has entries |
| `canRedo()` | Whether the redo stack has entries |
| `clear()` | Clear both stacks |
| `getUndoStack()` | Array of `{ label, timestamp }` for inspection |
| `getRedoStack()` | Array of `{ label, timestamp }` for inspection |

::: tip
The default `maxSize` is **50**. When the stack exceeds this limit, the oldest entry is discarded. Increase it for editors that need deep history, or decrease it to save memory.
:::

## NodeRegistry

`NodeRegistry` is a catalog of reusable node types. Combined with `defineNode()`, it lets you declare node blueprints once and instantiate them throughout your application.

### Defining Nodes

```typescript
import { defineNode } from '@quantum-studios/flow'

const AddNode = defineNode({
  type: 'math/add',
  label: 'Add',
  category: 'math',
  color: '#34d399',
  inputs: [
    { id: 'a', type: 'number', label: 'A' },
    { id: 'b', type: 'number', label: 'B' },
  ],
  outputs: [
    { id: 'result', type: 'number', label: 'Result' },
  ],
  defaultData: { precision: 2 },
})
```

`defineNode` returns a `NodeDefinitionWithFactory` that includes a `createInstance` method:

```typescript
const node = AddNode.createInstance({ x: 200, y: 100 })
// node.id is a UUID, type is 'math/add', data is { precision: 2 }
store.addNode(node)
```

### Using the Registry

```typescript
import { NodeRegistry } from '@quantum-studios/flow'

const registry = new NodeRegistry()
registry.registerMany([AddNode, SubtractNode, MultiplyNode])

// Look up a definition by type
const def = registry.get('math/add')
if (def) {
  const node = def.createInstance({ x: 0, y: 0 })
  store.addNode(node)
}

// Browse all categories
const categories = registry.getCategories()
// Map { 'math' => [AddNode, SubtractNode, MultiplyNode] }

// Filter by namespace
const mathNodes = registry.getByNamespace('math')
```

### Registry API

| Method | Description |
|--------|-------------|
| `register(def)` | Register a single node definition |
| `registerMany(defs)` | Register multiple definitions at once |
| `unregister(type)` | Remove a definition by type string |
| `has(type)` | Check if a type is registered |
| `get(type)` | Get a definition by type, or `undefined` |
| `getAll()` | Get all registered definitions |
| `getByNamespace(ns)` | Get definitions whose type starts with `ns/` |
| `getCategories()` | Group definitions by namespace prefix |

::: info
The namespace is derived from the part of the `type` string before the first `/`. A type of `"math/add"` belongs to the `"math"` namespace. Types without a `/` fall into the `"default"` namespace.
:::

## Putting It All Together

In practice, you rarely use these primitives directly. The `useFlowEditor` hook composes all of them into a single API:

```tsx
import { useFlowEditor, FlowCanvas, Validator, defineNode } from '@quantum-studios/flow'

const AddNode = defineNode({
  type: 'math/add',
  label: 'Add',
  color: '#34d399',
  inputs: [
    { id: 'a', type: 'number', label: 'A' },
    { id: 'b', type: 'number', label: 'B' },
  ],
  outputs: [
    { id: 'result', type: 'number', label: 'Result' },
  ],
})

function App() {
  const editor = useFlowEditor({
    validator: new Validator([
      Validator.noSelfConnection(),
      Validator.noDuplicateConnection(),
      Validator.typeCompatibility(),
    ]),
    history: { maxSize: 100 },
    registry: [AddNode],
  })

  return (
    <div>
      <button onClick={() => editor.undo()} disabled={!editor.canUndo}>
        Undo
      </button>
      <button onClick={() => editor.redo()} disabled={!editor.canRedo}>
        Redo
      </button>
      <FlowCanvas store={editor.store} />
    </div>
  )
}
```

This gives you a fully functional editor with validation, undo/redo, clipboard, and a node registry -- all from a few lines of code.
