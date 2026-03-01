# React Hooks

`@quantum-studios/flow` provides a layered hook system. At the top level, `useFlowEditor` is the all-in-one hook that composes everything you need. Beneath it, individual hooks like `useGraphStore`, `useHistory`, and `useClipboard` are available for advanced use cases where you need finer control.

## useFlowEditor

This is the primary hook for building a node editor. It creates a `GraphStore`, wires up history (undo/redo), clipboard (copy/cut/paste), and optionally sets up a `NodeRegistry`.

### Signature

```typescript
function useFlowEditor(options?: UseFlowEditorOptions): FlowEditorAPI
```

### Options

```typescript
interface UseFlowEditorOptions {
  initialGraph?: FlowGraph
  validator?: Validator
  history?: boolean | { maxSize?: number }
  registry?: NodeDefinitionWithFactory[]
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialGraph` | `FlowGraph` | `{ nodes: [], connections: [] }` | Pre-populate the editor with existing data |
| `validator` | `Validator` | `undefined` | Validation rules applied before mutations |
| `history` | `boolean \| { maxSize?: number }` | `true` | Enable undo/redo. Pass `false` to disable, or `{ maxSize }` to configure stack size. |
| `registry` | `NodeDefinitionWithFactory[]` | `undefined` | Node definitions to register (built with `defineNode()`) |

### Return Value: FlowEditorAPI

```typescript
interface FlowEditorAPI {
  // Store
  store: GraphStore

  // History
  undo(): boolean
  redo(): boolean
  canUndo: boolean
  canRedo: boolean

  // Graph mutations
  addNode(node: FlowNode): void
  removeNode(nodeId: string): void
  addConnection(connection: FlowConnection): void
  removeConnection(connectionId: string): void
  moveNode(nodeId: string, position: FlowNodePosition): void
  updateNodeData(nodeId: string, data: Record<string, unknown>): void
  batch(fn: () => void): void
  clear(): void

  // Queries
  getNode(id: string): FlowNode | undefined
  getNodes(): FlowNode[]
  getConnections(): FlowConnection[]
  getConnectionsForNode(nodeId: string): FlowConnection[]

  // Clipboard
  copy(nodeIds: Set<string> | string[]): void
  cut(nodeIds: Set<string> | string[]): void
  paste(offset?: { x: number; y: number }): FlowNode[]
  canPaste: boolean

  // Serialization
  toJSON(): FlowGraph
  fromJSON(graph: FlowGraph): void

  // Registry
  registry: NodeRegistry | null
}
```

### Complete Example

```tsx
import {
  useFlowEditor,
  FlowCanvas,
  Validator,
  defineNode,
} from '@quantum-studios/flow'

const PrintNode = defineNode({
  type: 'io/print',
  label: 'Print',
  color: '#f472b6',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'message', type: 'string', label: 'Message' },
  ],
  outputs: [
    { id: 'exec', type: 'exec', label: '' },
  ],
})

function Editor() {
  const editor = useFlowEditor({
    validator: new Validator([
      Validator.noSelfConnection(),
      Validator.noDuplicateConnection(),
      Validator.typeCompatibility(),
    ]),
    history: { maxSize: 200 },
    registry: [PrintNode],
  })

  const handleAddNode = () => {
    const def = editor.registry?.get('io/print')
    if (def) {
      const node = def.createInstance({ x: 100, y: 100 })
      editor.addNode(node)
    }
  }

  const handleSave = () => {
    const json = editor.toJSON()
    localStorage.setItem('graph', JSON.stringify(json))
  }

  const handleLoad = () => {
    const raw = localStorage.getItem('graph')
    if (raw) {
      editor.fromJSON(JSON.parse(raw))
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: 8 }}>
        <button onClick={handleAddNode}>Add Print Node</button>
        <button onClick={() => editor.undo()} disabled={!editor.canUndo}>
          Undo
        </button>
        <button onClick={() => editor.redo()} disabled={!editor.canRedo}>
          Redo
        </button>
        <button onClick={handleSave}>Save</button>
        <button onClick={handleLoad}>Load</button>
      </div>
      <FlowCanvas store={editor.store} height="80vh" />
    </div>
  )
}
```

### History Configuration

By default, history is enabled with a stack size of 50. You can configure or disable it:

```tsx
// Default: history enabled, maxSize 50
const editor = useFlowEditor()

// Custom stack size
const editor = useFlowEditor({ history: { maxSize: 200 } })

// History disabled (saves memory for viewer-only scenarios)
const editor = useFlowEditor({ history: false })
```

::: tip
When `history` is `false`, calling `editor.undo()` and `editor.redo()` is safe but always returns `false`. The `canUndo` and `canRedo` properties are always `false`.
:::

## useGraphStore

Creates a stable `GraphStore` instance. This is the lowest-level hook -- use it when you need a store without any of the higher-level features (history, clipboard, registry).

### Signature

```typescript
function useGraphStore(options?: UseGraphStoreOptions): GraphStore
```

### Options

```typescript
interface UseGraphStoreOptions {
  initialGraph?: FlowGraph
  validator?: Validator
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialGraph` | `FlowGraph` | `undefined` | Import this graph on creation |
| `validator` | `Validator` | `undefined` | Validation rules |

### Usage

```tsx
import { useGraphStore, FlowCanvas, Validator } from '@quantum-studios/flow'

function MinimalEditor() {
  const store = useGraphStore({
    validator: new Validator([
      Validator.noSelfConnection(),
    ]),
  })

  return <FlowCanvas store={store} />
}
```

::: warning
`useGraphStore` creates the store once and ignores option changes on subsequent renders. The `initialGraph` and `validator` are only applied at mount time.
:::

### When to Use

Use `useGraphStore` directly when:

- You are building a **read-only viewer** and don't need undo/redo or clipboard
- You need **multiple independent stores** (e.g., a diff view comparing two graphs)
- You want to **compose hooks manually** for a specialized use case

For most editors, prefer `useFlowEditor` instead.

## useHistory

A React hook that wraps `HistoryManager` with reactive state. It provides `canUndo` and `canRedo` as boolean values that trigger re-renders when the undo/redo stacks change.

### Signature

```typescript
function useHistory(store: GraphStore, options?: UseHistoryOptions): UseHistoryAPI
```

### Options

```typescript
interface UseHistoryOptions {
  maxSize?: number   // Default: 50
}
```

### Return Value

```typescript
interface UseHistoryAPI {
  undo(): boolean
  redo(): boolean
  canUndo: boolean       // Reactive -- triggers re-render on change
  canRedo: boolean       // Reactive -- triggers re-render on change
  history: HistoryManager // The underlying HistoryManager instance
}
```

### Usage

```tsx
import { useGraphStore, useHistory, FlowCanvas } from '@quantum-studios/flow'

function EditorWithHistory() {
  const store = useGraphStore()
  const { undo, redo, canUndo, canRedo, history } = useHistory(store, {
    maxSize: 100,
  })

  const showStack = () => {
    const stack = history.getUndoStack()
    console.log('Undo stack:', stack.map(e => e.label))
  }

  return (
    <div>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
      <button onClick={showStack}>Show History</button>
      <FlowCanvas store={store} />
    </div>
  )
}
```

### Reactivity

`canUndo` and `canRedo` are React state values that update whenever the store emits a mutation event. This means your UI automatically reflects whether undo/redo is available without polling.

```tsx
// The button's disabled state updates automatically
<button disabled={!canUndo}>Undo</button>
```

## Comparison Table

| Feature | `useFlowEditor` | `useGraphStore` + `useHistory` + `useClipboard` |
|---------|-----------------|--------------------------------------------------|
| GraphStore | Included | `useGraphStore()` |
| Undo / Redo | Included (configurable) | `useHistory(store)` |
| Clipboard | Included | `useClipboard(store)` |
| NodeRegistry | Included (via `registry` option) | Manual setup |
| Serialization | `toJSON()` / `fromJSON()` | `store.getState()` / `store.importGraph()` |
| Lines of code | 1 hook call | 3+ hook calls |
| Flexibility | Standard editor setup | Full control over composition |

### When to Use Each

**Use `useFlowEditor`** when:
- You are building a standard node editor
- You want undo/redo, clipboard, and a registry out of the box
- You prefer a simple, single-hook API

**Use individual hooks** when:
- You need a store without history (e.g., a lightweight viewer)
- You want to share a store between multiple components without `FlowProvider`
- You need to access `HistoryManager` directly (e.g., to display the undo stack in a sidebar)
- You are building a custom composition that doesn't fit the standard pattern

### Example: Composing Hooks Manually

```tsx
import {
  useGraphStore,
  useHistory,
  useClipboard,
  FlowCanvas,
  Validator,
} from '@quantum-studios/flow'

function CustomEditor() {
  const store = useGraphStore({
    validator: new Validator([
      Validator.noSelfConnection(),
      Validator.noDuplicateConnection(),
    ]),
  })

  const { undo, redo, canUndo, canRedo, history } = useHistory(store, {
    maxSize: 100,
  })

  const { copy, cut, paste, canPaste } = useClipboard(store)

  // Full control: you can wire these into any UI you want
  return (
    <div>
      <Toolbar
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onCopy={() => copy(selectedIds)}
        onPaste={() => paste({ x: 20, y: 20 })}
        canPaste={canPaste}
        undoStack={history.getUndoStack()}
      />
      <FlowCanvas store={store} />
    </div>
  )
}
```
