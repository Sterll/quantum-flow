# Advanced

This page covers advanced usage patterns: writing custom validation rules, building node definitions with `defineNode` and `NodeRegistry`, performing batch operations for grouped undo/redo, and accessing `GraphStore` directly for low-level operations.

## Custom Validation Rules

The `Validator` class ships with 6 built-in rules, but you can write your own to enforce domain-specific constraints. Each rule is a plain object implementing the `ValidationRule` interface.

### ValidationRule Interface

```typescript
interface ValidationRule {
  name: string
  validate(context: ValidationContext): ValidationResult
}

interface ValidationContext {
  graph: FlowGraph                // Current graph state (before the mutation)
  action: 'addConnection' | 'addNode' | 'removeNode' | 'removeConnection'
  payload: FlowConnection | FlowNode | { connectionId: string } | { nodeId: string }
}

type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string }
```

The `validate` function receives the current graph, the action being attempted, and the payload (the node or connection being added/removed). It must return either `{ valid: true }` or `{ valid: false, reason: '...' }`.

### Example: Max Nodes Limit

```typescript
import type { ValidationRule, FlowNode } from '@quantum-studios/flow'

function maxNodes(limit: number): ValidationRule {
  return {
    name: 'maxNodes',
    validate(context) {
      if (context.action !== 'addNode') return { valid: true }
      if (context.graph.nodes.length >= limit) {
        return {
          valid: false,
          reason: `Cannot exceed ${limit} nodes`,
        }
      }
      return { valid: true }
    },
  }
}
```

### Example: Required Input Connections

This rule prevents removing a connection if the target pin is marked as non-optional:

```typescript
function requiredConnections(): ValidationRule {
  return {
    name: 'requiredConnections',
    validate(context) {
      if (context.action !== 'removeConnection') return { valid: true }

      const { connectionId } = context.payload as { connectionId: string }
      const connection = context.graph.connections.find(c => c.id === connectionId)
      if (!connection) return { valid: true }

      const targetNode = context.graph.nodes.find(n => n.id === connection.toNodeId)
      if (!targetNode) return { valid: true }

      const targetPin = targetNode.inputs.find(p => p.id === connection.toPinId)
      if (targetPin && !targetPin.optional) {
        // Check if there are other connections to this pin
        const otherConnections = context.graph.connections.filter(
          c => c.id !== connectionId
            && c.toNodeId === connection.toNodeId
            && c.toPinId === connection.toPinId,
        )
        if (otherConnections.length === 0) {
          return {
            valid: false,
            reason: `Cannot remove the only connection to required pin '${targetPin.label}'`,
          }
        }
      }
      return { valid: true }
    },
  }
}
```

### Example: Type Compatibility with Custom Conversions

The built-in `typeCompatibility` rule uses strict matching by default. You can override it to allow implicit type conversions:

```typescript
import { Validator } from '@quantum-studios/flow'

// Allow number -> string (auto-conversion), and object -> array
const relaxedTypes = Validator.typeCompatibility({
  exec: ['exec'],
  string: ['string'],
  number: ['number', 'string'],    // number can connect to string pins
  boolean: ['boolean', 'number'],  // boolean can connect to number pins
  object: ['object', 'array'],     // object can connect to array pins
  array: ['array'],
})
```

### Composing Rules

The `Validator` runs rules in order and stops at the first failure. You can add and remove rules dynamically:

```typescript
const validator = new Validator([
  Validator.noSelfConnection(),
  Validator.noDuplicateConnection(),
])

// Add a rule later
validator.addRule(maxNodes(100))

// Remove by name
validator.removeRule('maxNodes')
```

### Error Handling

When a validation rule fails, `GraphStore` throws an `Error` with the rule's `reason` message. You should catch this in your UI:

```tsx
function handleAddConnection(connection: FlowConnection) {
  try {
    editor.addConnection(connection)
  } catch (error) {
    if (error instanceof Error) {
      showToast(error.message) // "Type incompatible: number -> boolean"
    }
  }
}
```

::: tip
`FlowCanvas` already catches validation errors internally when the user drags connections. Failed connections are simply not created, and the draft wire disappears. You only need error handling for programmatic mutations.
:::

## Node Definitions with defineNode

`defineNode` lets you declare node blueprints that can be instantiated repeatedly with unique IDs and consistent structure.

### defineNode API

```typescript
interface NodeDefinition {
  type: string                           // Unique type identifier (e.g., 'math/add')
  label: string                          // Display name
  color?: string                         // Accent color (hex)
  icon?: string                          // Icon identifier (for custom renderers)
  category?: string                      // Category for organization
  inputs: FlowPin[]                      // Input pin definitions
  outputs: FlowPin[]                     // Output pin definitions
  defaultData?: Record<string, unknown>  // Default data values
}

function defineNode(definition: NodeDefinition): NodeDefinitionWithFactory
```

The returned `NodeDefinitionWithFactory` extends the definition with a `createInstance` method:

```typescript
interface NodeDefinitionWithFactory extends NodeDefinition {
  createInstance(
    position: FlowNodePosition,
    overrides?: Partial<FlowNode>,
  ): FlowNode
}
```

### Defining a Complete Node Library

```typescript
import { defineNode } from '@quantum-studios/flow'

// --- Math nodes ---

export const NumberNode = defineNode({
  type: 'math/number',
  label: 'Number',
  color: '#34d399',
  category: 'Math',
  inputs: [],
  outputs: [{ id: 'value', type: 'number', label: 'Value' }],
  defaultData: { value: 0 },
})

export const AddNode = defineNode({
  type: 'math/add',
  label: 'Add',
  color: '#34d399',
  category: 'Math',
  inputs: [
    { id: 'a', type: 'number', label: 'A' },
    { id: 'b', type: 'number', label: 'B' },
  ],
  outputs: [{ id: 'result', type: 'number', label: 'Result' }],
})

export const ClampNode = defineNode({
  type: 'math/clamp',
  label: 'Clamp',
  color: '#34d399',
  category: 'Math',
  inputs: [
    { id: 'value', type: 'number', label: 'Value' },
    { id: 'min', type: 'number', label: 'Min' },
    { id: 'max', type: 'number', label: 'Max' },
  ],
  outputs: [{ id: 'result', type: 'number', label: 'Result' }],
  defaultData: { min: 0, max: 1 },
})

// --- Logic nodes ---

export const IfNode = defineNode({
  type: 'logic/if',
  label: 'If',
  color: '#fb923c',
  category: 'Logic',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'condition', type: 'boolean', label: 'Condition' },
  ],
  outputs: [
    { id: 'true', type: 'exec', label: 'True' },
    { id: 'false', type: 'exec', label: 'False' },
  ],
})

// --- I/O nodes ---

export const PrintNode = defineNode({
  type: 'io/print',
  label: 'Print',
  color: '#f472b6',
  category: 'I/O',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'message', type: 'string', label: 'Message' },
  ],
  outputs: [
    { id: 'exec', type: 'exec', label: '' },
  ],
})
```

### Pin Validation

`defineNode` validates that pin IDs are unique within inputs and outputs at definition time. Duplicate pin IDs throw an error immediately:

```typescript
// This throws: "Duplicate pin ID 'a' in math/broken inputs"
const BrokenNode = defineNode({
  type: 'math/broken',
  label: 'Broken',
  inputs: [
    { id: 'a', type: 'number', label: 'A' },
    { id: 'a', type: 'number', label: 'B' }, // duplicate!
  ],
  outputs: [],
})
```

### Creating Instances

Each call to `createInstance` generates a node with a unique UUID:

```typescript
const node1 = AddNode.createInstance({ x: 100, y: 100 })
const node2 = AddNode.createInstance({ x: 300, y: 100 })

console.log(node1.id) // "a1b2c3d4-..." (UUID)
console.log(node2.id) // "e5f6g7h8-..." (different UUID)
console.log(node1.type) // "math/add"
console.log(node2.type) // "math/add"
```

You can override any property at creation time:

```typescript
const customNode = AddNode.createInstance(
  { x: 200, y: 200 },
  {
    id: 'my-custom-id',
    label: 'Custom Add',
    color: '#ff0000',
    data: { precision: 4 },
  },
)
```

## NodeRegistry

`NodeRegistry` organizes node definitions into a queryable catalog.

### Building a Node Palette

A common pattern is to use the registry to build a node creation palette:

```tsx
import { useFlowContext } from '@quantum-studios/flow'

function NodePalette() {
  const editor = useFlowContext()
  const registry = editor.registry
  if (!registry) return null

  const categories = registry.getCategories()

  return (
    <div style={{ width: 200, borderRight: '1px solid #333' }}>
      {Array.from(categories.entries()).map(([category, definitions]) => (
        <div key={category}>
          <h4 style={{ padding: '8px 12px', color: '#888' }}>
            {category.toUpperCase()}
          </h4>
          {definitions.map(def => (
            <button
              key={def.type}
              onClick={() => {
                const node = def.createInstance({
                  x: 200 + Math.random() * 100,
                  y: 200 + Math.random() * 100,
                })
                editor.addNode(node)
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 12px',
                textAlign: 'left',
                borderLeft: `3px solid ${def.color ?? '#6b7280'}`,
              }}
            >
              {def.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
```

### Namespace Filtering

If your registry contains nodes from multiple libraries, you can filter by namespace:

```typescript
const registry = new NodeRegistry()
registry.registerMany([...mathNodes, ...logicNodes, ...ioNodes])

const mathOnly = registry.getByNamespace('math')
// [NumberNode, AddNode, ClampNode]

const logicOnly = registry.getByNamespace('logic')
// [IfNode]
```

### Dynamic Registration

You can register and unregister node types at runtime. This is useful for plugin systems:

```typescript
// Register a plugin's nodes
function loadPlugin(plugin: { nodes: NodeDefinitionWithFactory[] }) {
  for (const def of plugin.nodes) {
    if (!registry.has(def.type)) {
      registry.register(def)
    }
  }
}

// Unregister when plugin is unloaded
function unloadPlugin(plugin: { nodes: NodeDefinitionWithFactory[] }) {
  for (const def of plugin.nodes) {
    registry.unregister(def.type)
  }
}
```

## Batch Operations

Batch operations group multiple mutations into a single undo/redo entry. This is critical for operations that involve several steps but should be atomic from the user's perspective.

### Basic Batch

```typescript
editor.batch(() => {
  const nodeA = AddNode.createInstance({ x: 100, y: 100 })
  const nodeB = AddNode.createInstance({ x: 400, y: 100 })

  editor.addNode(nodeA)
  editor.addNode(nodeB)
  editor.addConnection({
    id: crypto.randomUUID(),
    fromNodeId: nodeA.id,
    fromPinId: 'result',
    toNodeId: nodeB.id,
    toPinId: 'a',
  })
})

// One undo() call reverts all three operations
editor.undo()
```

### Use Cases for Batch

**Template insertion** -- Adding a group of pre-connected nodes:

```typescript
function insertTemplate(editor: FlowEditorAPI) {
  editor.batch(() => {
    const input = NumberNode.createInstance({ x: 100, y: 100 })
    const add = AddNode.createInstance({ x: 350, y: 100 })
    const print = PrintNode.createInstance({ x: 600, y: 100 })

    editor.addNode(input)
    editor.addNode(add)
    editor.addNode(print)

    editor.addConnection({
      id: crypto.randomUUID(),
      fromNodeId: input.id,
      fromPinId: 'value',
      toNodeId: add.id,
      toPinId: 'a',
    })
  })
}
```

**Bulk deletion** -- Removing multiple nodes at once:

```typescript
function deleteSelected(editor: FlowEditorAPI, selectedIds: Set<string>) {
  editor.batch(() => {
    for (const id of selectedIds) {
      editor.removeNode(id)
    }
  })
}
```

**Layout operations** -- Repositioning multiple nodes:

```typescript
function alignHorizontally(editor: FlowEditorAPI, nodeIds: string[]) {
  const nodes = nodeIds.map(id => editor.getNode(id)).filter(Boolean)
  if (nodes.length === 0) return

  const avgY = nodes.reduce((sum, n) => sum + n!.position.y, 0) / nodes.length

  editor.batch(() => {
    for (const node of nodes) {
      editor.moveNode(node!.id, { x: node!.position.x, y: avgY })
    }
  })
}
```

::: warning
Batch operations are **not nested**. Calling `batch()` inside another `batch()` currently flattens into the outer batch. Avoid nesting batches.
:::

### Batch and History Labels

When a batch contains multiple events, the `HistoryManager` uses the label of the first event in the batch. For example, if the first operation inside the batch is `addNode`, the history label will be something like `"Added node 'Add'"`.

## Direct GraphStore Access

For advanced scenarios, you may need to access the `GraphStore` directly instead of going through the `FlowEditorAPI` wrapper.

### Subscribing to Events

The store's `EventBus` lets you react to any mutation in real time:

```typescript
const editor = useFlowEditor()
const { store } = editor

useEffect(() => {
  const unsubNodeAdded = store.events.on('node:added', ({ node }) => {
    console.log(`Node added: ${node.label} at (${node.position.x}, ${node.position.y})`)
  })

  const unsubNodeRemoved = store.events.on('node:removed', ({ nodeId, removedConnections }) => {
    console.log(`Node ${nodeId} removed, ${removedConnections.length} connections cleaned up`)
  })

  const unsubBatchEnd = store.events.on('batch:end', ({ events }) => {
    console.log(`Batch completed with ${events.length} operations`)
  })

  return () => {
    unsubNodeAdded()
    unsubNodeRemoved()
    unsubBatchEnd()
  }
}, [store])
```

### Building Derived State

You can build computed state by subscribing to store events:

```typescript
function useNodeCount(): number {
  const { store } = useFlowContext()
  const [count, setCount] = useState(store.getNodes().length)

  useEffect(() => {
    const update = () => setCount(store.getNodes().length)

    const unsubs = [
      store.events.on('node:added', update),
      store.events.on('node:removed', update),
      store.events.on('graph:cleared', update),
      store.events.on('graph:imported', update),
      store.events.on('batch:end', update),
    ]

    return () => unsubs.forEach(fn => fn())
  }, [store])

  return count
}
```

### Graph Queries

`GraphStore` provides several query methods for traversing the graph:

```typescript
// Get all connections for a specific node
const nodeConns = store.getConnectionsForNode('node-1')

// Get all connections for a specific pin
const pinConns = store.getConnectionsForPin('node-1', 'output-a')

// Check if a specific connection exists
const exists = store.hasConnection('node-1', 'result', 'node-2', 'a')

// Get a deep copy of the graph
const snapshot = store.getState()
```

### Cloning the Store

`clone()` creates a deep copy of the store, useful for previewing changes or running "what-if" scenarios:

```typescript
const preview = store.clone()

// Make changes on the clone without affecting the original
preview.addNode(testNode)
preview.addConnection(testConnection)

// Inspect the result
const previewState = preview.getState()
console.log(`Preview has ${previewState.nodes.length} nodes`)

// If satisfied, apply to the real store
store.importGraph(previewState)
```

### Serialization and Persistence

`GraphStore` uses plain JSON-serializable objects internally. Saving and loading is straightforward:

```typescript
// Save
function saveGraph(store: GraphStore): string {
  return JSON.stringify(store.getState())
}

// Load
function loadGraph(store: GraphStore, json: string): void {
  const graph: FlowGraph = JSON.parse(json)
  store.importGraph(graph)
}

// With FlowEditorAPI
const json = editor.toJSON()                     // FlowGraph object
editor.fromJSON(JSON.parse(savedGraphString))     // Restore
```

::: tip
`importGraph` replaces the entire graph atomically and emits a single `graph:imported` event. This means a load operation creates exactly one undo entry, not one per node/connection.
:::
