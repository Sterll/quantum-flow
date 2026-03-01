# Context Provider

When your editor UI spans multiple components (toolbar, canvas, inspector, sidebar), passing the `FlowEditorAPI` as props through every level becomes tedious. `FlowProvider` and `useFlowContext` solve this by exposing the editor through React context.

## FlowProvider

`FlowProvider` wraps `useFlowEditor` internally and makes the resulting `FlowEditorAPI` available to all descendant components via context.

### Signature

```typescript
interface FlowProviderProps extends UseFlowEditorOptions {
  children: React.ReactNode
}

function FlowProvider({ children, ...options }: FlowProviderProps): JSX.Element
```

`FlowProviderProps` accepts the same options as `useFlowEditor`:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialGraph` | `FlowGraph` | `undefined` | Pre-populate the graph |
| `validator` | `Validator` | `undefined` | Validation rules |
| `history` | `boolean \| { maxSize?: number }` | `true` | Undo/redo configuration |
| `registry` | `NodeDefinitionWithFactory[]` | `undefined` | Node type definitions |
| `children` | `React.ReactNode` | **required** | Child components |

### Basic Usage

```tsx
import { FlowProvider, Validator } from '@quantum-studios/flow'

function App() {
  return (
    <FlowProvider
      validator={new Validator([
        Validator.noSelfConnection(),
        Validator.noDuplicateConnection(),
        Validator.typeCompatibility(),
      ])}
      history={{ maxSize: 100 }}
    >
      <EditorLayout />
    </FlowProvider>
  )
}
```

## useFlowContext

Retrieves the `FlowEditorAPI` from the nearest `FlowProvider` ancestor.

### Signature

```typescript
function useFlowContext(): FlowEditorAPI
```

### Error Handling

If `useFlowContext` is called outside of a `FlowProvider`, it throws an error:

```
Error: useFlowContext must be used within a FlowProvider
```

::: danger
Always make sure `useFlowContext` is called inside a component wrapped by `FlowProvider`. Calling it outside will crash your application.
:::

## Full Example: Toolbar + Canvas + Inspector

This example shows the typical multi-component editor architecture where every part of the UI accesses the same editor through context.

```tsx
import {
  FlowProvider,
  FlowCanvas,
  useFlowContext,
  Validator,
  defineNode,
} from '@quantum-studios/flow'
import { useState } from 'react'

// --- Node Definitions ---

const NumberNode = defineNode({
  type: 'math/number',
  label: 'Number',
  color: '#34d399',
  inputs: [],
  outputs: [{ id: 'value', type: 'number', label: 'Value' }],
  defaultData: { value: 0 },
})

const AddNode = defineNode({
  type: 'math/add',
  label: 'Add',
  color: '#34d399',
  inputs: [
    { id: 'a', type: 'number', label: 'A' },
    { id: 'b', type: 'number', label: 'B' },
  ],
  outputs: [{ id: 'result', type: 'number', label: 'Result' }],
})

// --- Toolbar Component ---

function Toolbar() {
  const editor = useFlowContext()

  const handleAddNode = (type: string) => {
    const def = editor.registry?.get(type)
    if (def) {
      const node = def.createInstance({
        x: Math.random() * 400,
        y: Math.random() * 300,
      })
      editor.addNode(node)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, padding: 8, borderBottom: '1px solid #333' }}>
      <button onClick={() => handleAddNode('math/number')}>
        + Number
      </button>
      <button onClick={() => handleAddNode('math/add')}>
        + Add
      </button>
      <span style={{ borderLeft: '1px solid #555', margin: '0 4px' }} />
      <button onClick={() => editor.undo()} disabled={!editor.canUndo}>
        Undo
      </button>
      <button onClick={() => editor.redo()} disabled={!editor.canRedo}>
        Redo
      </button>
      <span style={{ borderLeft: '1px solid #555', margin: '0 4px' }} />
      <button onClick={() => editor.clear()}>
        Clear
      </button>
    </div>
  )
}

// --- Canvas Wrapper ---

function CanvasPanel() {
  const editor = useFlowContext()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  return (
    <FlowCanvas
      store={editor.store}
      onSelectionChange={setSelectedIds}
      width="100%"
      height="100%"
    />
  )
}

// --- Inspector Panel ---

function Inspector() {
  const editor = useFlowContext()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // In a real app, you would lift selectedIds up or use another context.
  // This is simplified for illustration.
  const selectedNodes = Array.from(selectedIds)
    .map(id => editor.getNode(id))
    .filter(Boolean)

  if (selectedNodes.length === 0) {
    return (
      <div style={{ padding: 16, color: '#888' }}>
        Select a node to inspect its properties.
      </div>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      {selectedNodes.map(node => (
        <div key={node!.id}>
          <h3>{node!.label}</h3>
          <p>Type: {node!.type}</p>
          <p>Position: ({node!.position.x}, {node!.position.y})</p>
          <p>Inputs: {node!.inputs.length}</p>
          <p>Outputs: {node!.outputs.length}</p>
          {Object.entries(node!.data).map(([key, value]) => (
            <div key={key}>
              <label>{key}: </label>
              <input
                value={String(value)}
                onChange={e =>
                  editor.updateNodeData(node!.id, { [key]: e.target.value })
                }
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// --- App Layout ---

function EditorLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ flex: 1 }}>
          <CanvasPanel />
        </div>
        <div style={{ width: 280, borderLeft: '1px solid #333', overflow: 'auto' }}>
          <Inspector />
        </div>
      </div>
    </div>
  )
}

// --- Root ---

function App() {
  return (
    <FlowProvider
      validator={new Validator([
        Validator.noSelfConnection(),
        Validator.noDuplicateConnection(),
        Validator.typeCompatibility(),
      ])}
      history={{ maxSize: 100 }}
      registry={[NumberNode, AddNode]}
    >
      <EditorLayout />
    </FlowProvider>
  )
}
```

## When to Use Provider vs Prop Drilling

### Use `FlowProvider` + `useFlowContext` when:

- Your editor has **3+ components** that need access to the editor API
- Components are **deeply nested** (toolbar > menu > button all need `undo()`)
- You want to **add new components** without threading props through intermediate layers
- Multiple **sibling components** need the same editor (canvas, inspector, minimap)

### Use prop drilling when:

- Your editor is **simple** (one component with a toolbar)
- You have **only 1-2 levels** of nesting
- You want **explicit data flow** that is easy to trace
- You are building a **reusable widget** that should not assume a provider exists

### Comparison

::: code-group

```tsx [With Provider]
// Clean: each component gets what it needs from context
function App() {
  return (
    <FlowProvider history={{ maxSize: 100 }}>
      <Toolbar />        {/* calls useFlowContext() */}
      <CanvasPanel />    {/* calls useFlowContext() */}
      <Inspector />      {/* calls useFlowContext() */}
    </FlowProvider>
  )
}
```

```tsx [With Props]
// Explicit: everything is passed down manually
function App() {
  const editor = useFlowEditor({ history: { maxSize: 100 } })

  return (
    <>
      <Toolbar
        onUndo={editor.undo}
        onRedo={editor.redo}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onClear={editor.clear}
        registry={editor.registry}
        addNode={editor.addNode}
      />
      <CanvasPanel store={editor.store} />
      <Inspector
        getNode={editor.getNode}
        updateNodeData={editor.updateNodeData}
      />
    </>
  )
}
```

:::

::: tip
There is no performance difference between the two approaches. `FlowProvider` uses a single React context, so only components that call `useFlowContext()` re-render when the context value changes. In practice, the `FlowEditorAPI` object is stable across renders (all methods are memoized), so context consumers do not re-render unnecessarily.
:::

## Multiple Providers

You can nest multiple `FlowProvider` instances to create independent editors:

```tsx
function DiffView({ before, after }: { before: FlowGraph; after: FlowGraph }) {
  return (
    <div style={{ display: 'flex' }}>
      <FlowProvider initialGraph={before}>
        <div style={{ flex: 1 }}>
          <h3>Before</h3>
          <ReadOnlyCanvas />
        </div>
      </FlowProvider>
      <FlowProvider initialGraph={after}>
        <div style={{ flex: 1 }}>
          <h3>After</h3>
          <ReadOnlyCanvas />
        </div>
      </FlowProvider>
    </div>
  )
}

function ReadOnlyCanvas() {
  const { store } = useFlowContext()
  return <FlowCanvas store={store} readOnly height={400} />
}
```

Each provider creates its own isolated `GraphStore`, `HistoryManager`, and clipboard buffer. They do not interfere with each other.
