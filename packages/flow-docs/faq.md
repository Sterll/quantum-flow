# Frequently Asked Questions

## How do I add custom pin types?

The `PinType` is defined as:

```typescript
type PinType = 'exec' | 'string' | 'number' | 'boolean' | 'object' | 'array' | (string & {})
```

The `(string & {})` part means **any string is a valid pin type**. You can use domain-specific types like `'vector3'`, `'color'`, `'texture'`, or `'playerRef'` without modifying the library.

```typescript
import { defineNode } from '@quantum-studios/flow'

const ColorMixNode = defineNode({
  type: 'color/mix',
  label: 'Mix Colors',
  inputs: [
    { id: 'a', type: 'color', label: 'Color A' },
    { id: 'b', type: 'color', label: 'Color B' },
    { id: 'factor', type: 'number', label: 'Factor' },
  ],
  outputs: [
    { id: 'result', type: 'color', label: 'Result' },
  ],
})
```

To control which types can connect to each other, use `Validator.typeCompatibility()` with a custom override map:

```typescript
import { Validator } from '@quantum-studios/flow'

const typeRules = Validator.typeCompatibility({
  exec: ['exec'],
  string: ['string'],
  number: ['number', 'string'],   // numbers can connect to string pins
  boolean: ['boolean', 'number'], // booleans can connect to number pins
  color: ['color'],               // custom type -- only connects to itself
  vector3: ['vector3'],           // another custom type
})
```

---

## How do I validate connections (type checking)?

Use the `Validator` class with one or more built-in rules. Pass it to the `GraphStore` constructor or to the `useFlowEditor` hook.

```typescript
import { Validator, useFlowEditor } from '@quantum-studios/flow'

const validator = new Validator([
  Validator.noSelfConnection(),        // cannot connect a node to itself
  Validator.noDuplicateConnection(),   // no duplicate wires
  Validator.typeCompatibility(),       // pin types must match
  Validator.noCycles(),                // no circular graphs
  Validator.maxConnectionsPerPin(1),   // at most 1 connection per input pin
])

const editor = useFlowEditor({ validator })
```

When a rule fails, the mutation throws an `Error`. `FlowCanvas` catches these internally when the user drags connections, so invalid wires simply don't connect. For programmatic mutations, wrap calls in try/catch:

```typescript
try {
  editor.addConnection(connection)
} catch (error) {
  console.warn('Connection rejected:', error.message)
}
```

You can also write **custom validation rules** for domain-specific constraints. See the [Advanced guide](/guide/advanced#custom-validation-rules) for details.

---

## How do I customize node rendering?

`@quantum-studios/flow` is a **headless library**. `FlowCanvas` provides a default Canvas 2D renderer, but you are free to build your own UI on top of the model layer.

The model layer (`GraphStore`, `EventBus`, `Validator`, `HistoryManager`, `defineNode`, `NodeRegistry`) has **zero dependency on React or any rendering library**. You can use it to manage your graph state and subscribe to changes, then render nodes however you want -- with DOM elements, SVG, WebGL, or any other approach.

### Example: custom React/DOM rendering

```tsx
import { useFlowEditor } from '@quantum-studios/flow'

function MyCustomEditor() {
  const editor = useFlowEditor()
  const nodes = editor.store.getNodes()

  return (
    <div style={{ position: 'relative', width: '100%', height: 600 }}>
      {nodes.map(node => (
        <div
          key={node.id}
          style={{
            position: 'absolute',
            left: node.position.x,
            top: node.position.y,
            background: node.color ?? '#1e1e2e',
            borderRadius: 8,
            padding: 12,
          }}
        >
          <strong>{node.label}</strong>
          {/* Render custom pin UI, data fields, etc. */}
        </div>
      ))}
    </div>
  )
}
```

You can subscribe to `GraphStore` events (via `store.events.on(...)`) to re-render when nodes are added, removed, moved, or connected. See [Direct GraphStore Access](/guide/advanced#direct-graphstore-access) for more.

---

## Can I use this without React?

**Yes.** The model layer is pure TypeScript with zero React dependency. You can use the following in any JavaScript/TypeScript environment -- Node.js, vanilla browser, Vue, Svelte, Angular, or any other framework:

| Module | React required? |
|--------|----------------|
| `GraphStore` | No |
| `EventBus` | No |
| `Validator` | No |
| `HistoryManager` | No |
| `defineNode` | No |
| `NodeRegistry` | No |
| All types (`FlowNode`, `FlowPin`, etc.) | No |
| `useFlowEditor`, `useGraphStore`, `useHistory`, `useClipboard` | **Yes** |
| `FlowProvider`, `FlowCanvas` | **Yes** |

### Example: vanilla TypeScript

```typescript
import { GraphStore, Validator, HistoryManager, defineNode, NodeRegistry } from '@quantum-studios/flow'

// Set up the model layer -- no React needed
const validator = new Validator([
  Validator.noSelfConnection(),
  Validator.noDuplicateConnection(),
  Validator.typeCompatibility(),
])

const store = new GraphStore({ validator })
const history = new HistoryManager(store, { maxSize: 50 })
const registry = new NodeRegistry()

// Define and register nodes
const AddNode = defineNode({
  type: 'math/add',
  label: 'Add',
  inputs: [
    { id: 'a', type: 'number', label: 'A' },
    { id: 'b', type: 'number', label: 'B' },
  ],
  outputs: [
    { id: 'result', type: 'number', label: 'Result' },
  ],
})

registry.register(AddNode)

// Use the store
const node = AddNode.createInstance({ x: 100, y: 100 })
store.addNode(node)

// Subscribe to events
store.events.on('node:added', ({ node }) => {
  console.log(`Node added: ${node.label}`)
})

// Undo / redo
history.undo()
history.redo()
```

---

## How do I persist the graph?

The `FlowEditorAPI` returned by `useFlowEditor` provides `toJSON()` and `fromJSON()` methods. The graph is a plain, JSON-serializable object.

### Save to localStorage

```typescript
// Save
const graph = editor.toJSON()
localStorage.setItem('my-graph', JSON.stringify(graph))

// Load
const saved = localStorage.getItem('my-graph')
if (saved) {
  editor.fromJSON(JSON.parse(saved))
}
```

### Save to a database or file

```typescript
// Save (send to your API)
const graph = editor.toJSON()
await fetch('/api/graphs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(graph),
})

// Load (fetch from your API)
const response = await fetch('/api/graphs/my-graph-id')
const graph = await response.json()
editor.fromJSON(graph)
```

### Using GraphStore directly

If you are not using the React API, you can serialize and restore via `GraphStore`:

```typescript
// Save
const snapshot = store.getState()  // returns a FlowGraph object
const json = JSON.stringify(snapshot)

// Load
const graph = JSON.parse(json)
store.importGraph(graph)           // replaces the entire graph atomically
```

::: tip
`importGraph` emits a single `graph:imported` event and creates exactly one undo entry, regardless of how many nodes and connections the graph contains.
:::

---

## How do I handle large graphs?

### Use batch operations

When adding, removing, or moving many nodes at once, wrap the operations in `batch()`. This produces a single history entry instead of one per mutation, and improves performance by reducing intermediate state calculations:

```typescript
editor.batch(() => {
  for (const nodeDef of hundredsOfNodes) {
    const node = nodeDef.createInstance({ x: nodeDef.x, y: nodeDef.y })
    editor.addNode(node)
  }
  for (const conn of connections) {
    editor.addConnection(conn)
  }
})
```

### O(1) lookups

`GraphStore` stores nodes and connections in `Map` structures internally, so lookups by ID are O(1). Methods like `getNode(id)`, `getConnectionsForNode(nodeId)`, and `getConnectionsForPin(nodeId, pinId)` are fast regardless of graph size.

### Viewport culling

`FlowCanvas` only renders nodes and connections that are visible within the current viewport. Nodes outside the visible area are skipped during the Canvas 2D draw pass. This means performance scales with the number of **visible** nodes, not the total number of nodes in the graph.

### Reduce history stack size

For very large graphs, each history snapshot stores a full copy of the graph state. Reduce memory usage by lowering `maxSize`:

```typescript
const editor = useFlowEditor({
  history: { maxSize: 20 }, // default is 50
})
```

### Import instead of individual adds

When loading a large graph, prefer `importGraph()` or `fromJSON()` over adding nodes one by one. This replaces the entire graph in a single operation:

```typescript
// Fast -- single operation, single event, single history entry
editor.fromJSON(largeGraph)

// Slower -- N operations, N events, N history entries
// (unless wrapped in batch)
for (const node of largeGraph.nodes) {
  editor.addNode(node)
}
```

::: info
If you must add nodes individually (for example, during a streaming import), always wrap the loop in `batch()` to avoid flooding the history stack.
:::
