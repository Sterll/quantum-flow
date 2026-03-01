# Hooks API Reference

Complete API reference for all React hooks exported by `@quantum-studios/flow`.

## useFlowEditor {#usefloweditor}

The all-in-one hook that creates a `GraphStore`, wires up history, clipboard, and optionally a `NodeRegistry`.

### Signature

```typescript
function useFlowEditor(options?: UseFlowEditorOptions): FlowEditorAPI
```

### Options — `UseFlowEditorOptions`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `initialGraph` | `FlowGraph` | `{ nodes: [], connections: [] }` | Pre-populate the editor with an existing graph |
| `validator` | `Validator` | `undefined` | Validation rules applied before every mutation |
| `history` | `boolean \| { maxSize?: number }` | `true` | Enable undo/redo. Pass `false` to disable, or `{ maxSize }` to cap the stack. |
| `registry` | `NodeDefinitionWithFactory[]` | `undefined` | Node definitions to register (built with `defineNode()`) |

```typescript
interface UseFlowEditorOptions {
  initialGraph?: FlowGraph
  validator?: Validator
  history?: boolean | { maxSize?: number }
  registry?: NodeDefinitionWithFactory[]
}
```

### Return — `FlowEditorAPI`

```typescript
interface FlowEditorAPI {
  store: GraphStore
  undo(): boolean
  redo(): boolean
  canUndo: boolean
  canRedo: boolean
  addNode(node: FlowNode): void
  removeNode(nodeId: string): void
  addConnection(connection: FlowConnection): void
  removeConnection(connectionId: string): void
  moveNode(nodeId: string, position: FlowNodePosition): void
  updateNodeData(nodeId: string, data: Record<string, unknown>): void
  batch(fn: () => void): void
  clear(): void
  getNode(id: string): FlowNode | undefined
  getNodes(): FlowNode[]
  getConnections(): FlowConnection[]
  getConnectionsForNode(nodeId: string): FlowConnection[]
  copy(nodeIds: Set<string> | string[]): void
  cut(nodeIds: Set<string> | string[]): void
  paste(offset?: { x: number; y: number }): FlowNode[]
  canPaste: boolean
  toJSON(): FlowGraph
  fromJSON(graph: FlowGraph): void
  registry: NodeRegistry | null
}
```

#### Store

| Property | Type | Description |
|----------|------|-------------|
| `store` | `GraphStore` | The underlying graph store instance |

#### History

| Member | Type | Description |
|--------|------|-------------|
| `undo()` | `() => boolean` | Undo the last action. Returns `true` if successful. |
| `redo()` | `() => boolean` | Redo the last undone action. Returns `true` if successful. |
| `canUndo` | `boolean` | Whether the undo stack has entries (reactive) |
| `canRedo` | `boolean` | Whether the redo stack has entries (reactive) |

#### Graph Mutations

| Method | Signature | Description |
|--------|-----------|-------------|
| `addNode` | `(node: FlowNode) => void` | Add a node to the graph |
| `removeNode` | `(nodeId: string) => void` | Remove a node and its connections |
| `addConnection` | `(connection: FlowConnection) => void` | Create a connection between two pins |
| `removeConnection` | `(connectionId: string) => void` | Remove a connection by ID |
| `moveNode` | `(nodeId: string, position: FlowNodePosition) => void` | Update a node's position |
| `updateNodeData` | `(nodeId: string, data: Record<string, unknown>) => void` | Merge data into a node's `data` object |
| `batch` | `(fn: () => void) => void` | Group multiple mutations into a single history entry |
| `clear` | `() => void` | Remove all nodes and connections |

#### Queries

| Method | Signature | Description |
|--------|-----------|-------------|
| `getNode` | `(id: string) => FlowNode \| undefined` | Look up a node by ID |
| `getNodes` | `() => FlowNode[]` | Get all nodes |
| `getConnections` | `() => FlowConnection[]` | Get all connections |
| `getConnectionsForNode` | `(nodeId: string) => FlowConnection[]` | Get all connections touching a node |

#### Clipboard

| Member | Type | Description |
|--------|------|-------------|
| `copy` | `(nodeIds: Set<string> \| string[]) => void` | Copy selected nodes to the clipboard buffer |
| `cut` | `(nodeIds: Set<string> \| string[]) => void` | Copy selected nodes, then remove them from the graph |
| `paste` | `(offset?: { x: number; y: number }) => FlowNode[]` | Paste buffered nodes with new IDs. Default offset: `{ x: 20, y: 20 }`. |
| `canPaste` | `boolean` | Whether the clipboard buffer has content (reactive) |

#### Serialization

| Method | Signature | Description |
|--------|-----------|-------------|
| `toJSON` | `() => FlowGraph` | Export the current graph as a serializable object |
| `fromJSON` | `(graph: FlowGraph) => void` | Replace the entire graph from a previously exported object |

#### Registry

| Property | Type | Description |
|----------|------|-------------|
| `registry` | `NodeRegistry \| null` | The node registry, or `null` if no `registry` option was provided |

### Example

```tsx
const editor = useFlowEditor({
  history: { maxSize: 100 },
  registry: [MyNodeDef],
})
editor.addNode(MyNodeDef.createInstance({ x: 0, y: 0 }))
```

---

## useGraphStore {#usegraphstore}

Creates a stable `GraphStore` instance. This is the lowest-level hook -- use it when you need a store without history, clipboard, or a registry.

### Signature

```typescript
function useGraphStore(options?: UseGraphStoreOptions): GraphStore
```

### Options — `UseGraphStoreOptions`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `initialGraph` | `FlowGraph` | `undefined` | Import this graph on creation |
| `validator` | `Validator` | `undefined` | Validation rules applied before mutations |

```typescript
interface UseGraphStoreOptions {
  initialGraph?: FlowGraph
  validator?: Validator
}
```

### Return — `GraphStore`

Returns a [`GraphStore`](/api/model#graphstore) instance. See the [Model reference](/api/model#graphstore) for the full API.

### Example

```tsx
const store = useGraphStore({ validator: new Validator([Validator.noSelfConnection()]) })
```

::: warning
`useGraphStore` creates the store once at mount time and ignores option changes on subsequent renders.
:::

---

## useHistory {#usehistory}

A React hook that wraps `HistoryManager` with reactive state. Provides `canUndo` and `canRedo` as boolean values that trigger re-renders when the undo/redo stacks change.

### Signature

```typescript
function useHistory(store: GraphStore, options?: UseHistoryOptions): UseHistoryAPI
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `store` | `GraphStore` | **required** | The graph store to track |
| `options` | `UseHistoryOptions` | `undefined` | Configuration |

### Options — `UseHistoryOptions`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxSize` | `number` | `50` | Maximum number of entries in the undo stack |

```typescript
interface UseHistoryOptions {
  maxSize?: number
}
```

### Return — `UseHistoryAPI`

| Member | Type | Description |
|--------|------|-------------|
| `undo()` | `() => boolean` | Undo the last action. Returns `true` if successful. |
| `redo()` | `() => boolean` | Redo the last undone action. Returns `true` if successful. |
| `canUndo` | `boolean` | Whether the undo stack has entries (reactive -- triggers re-render) |
| `canRedo` | `boolean` | Whether the redo stack has entries (reactive -- triggers re-render) |
| `history` | `HistoryManager` | The underlying `HistoryManager` instance for advanced access |

```typescript
interface UseHistoryAPI {
  undo(): boolean
  redo(): boolean
  canUndo: boolean
  canRedo: boolean
  history: HistoryManager
}
```

### Example

```tsx
const store = useGraphStore()
const { undo, redo, canUndo, canRedo } = useHistory(store, { maxSize: 100 })
```

---

## useClipboard {#useclipboard}

Provides copy, cut, and paste operations for a `GraphStore`. Handles node ID regeneration and connection remapping on paste.

### Signature

```typescript
function useClipboard(store: GraphStore): UseClipboardAPI
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `store` | `GraphStore` | **required** | The graph store to operate on |

### Return — `UseClipboardAPI`

| Member | Type | Description |
|--------|------|-------------|
| `copy` | `(nodeIds: Set<string> \| string[]) => void` | Copy selected nodes and their internal connections to the buffer |
| `cut` | `(nodeIds: Set<string> \| string[]) => void` | Copy selected nodes, then remove them in a single batch |
| `paste` | `(offset?: { x: number; y: number }) => FlowNode[]` | Paste buffered nodes with new UUIDs. Returns the created nodes. Default offset: `{ x: 20, y: 20 }`. |
| `canPaste` | `boolean` | Whether the clipboard buffer has content (reactive) |

```typescript
interface UseClipboardAPI {
  copy(nodeIds: Set<string> | string[]): void
  cut(nodeIds: Set<string> | string[]): void
  paste(offset?: { x: number; y: number }): FlowNode[]
  canPaste: boolean
}
```

### Example

```tsx
const store = useGraphStore()
const { copy, paste, canPaste } = useClipboard(store)
copy(['node-1', 'node-2'])
const newNodes = paste({ x: 50, y: 50 })
```

---

## useFlowContext {#useflowcontext}

Retrieves the `FlowEditorAPI` from the nearest `FlowProvider` ancestor. Must be called inside a component wrapped by `FlowProvider`.

### Signature

```typescript
function useFlowContext(): FlowEditorAPI
```

### Return — `FlowEditorAPI`

Returns the same [`FlowEditorAPI`](#return--floweditorapi) object documented under `useFlowEditor`.

### Example

```tsx
function Toolbar() {
  const editor = useFlowContext()
  return <button onClick={() => editor.undo()} disabled={!editor.canUndo}>Undo</button>
}
```

::: danger
Calling `useFlowContext` outside of a `FlowProvider` throws:
```
Error: useFlowContext must be used within a FlowProvider
```
:::
