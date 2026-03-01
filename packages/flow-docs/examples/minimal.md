# Minimal Example

A complete, copy-pasteable example that gets a working node editor on screen in under 30 lines. This is the fastest way to verify your setup works.

## The Code

```tsx
import { useFlowEditor, FlowCanvas } from '@quantum-studios/flow'

function App() {
  const editor = useFlowEditor()

  const addTestNode = () => {
    editor.addNode({
      id: crypto.randomUUID(),
      type: 'test/node',
      label: 'New Node',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      inputs: [{ id: 'in', type: 'exec', label: 'In' }],
      outputs: [{ id: 'out', type: 'exec', label: 'Out' }],
      data: {},
    })
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <button onClick={addTestNode}>Add Node</button>
      <FlowCanvas store={editor.store} />
    </div>
  )
}

export default App
```

## What You Get

- A full-screen canvas with pan (right-click drag) and zoom (mouse wheel)
- A button that spawns nodes at random positions
- Drag nodes by their title bar
- Connect pins by dragging from one pin to another
- Select nodes with left-click, multi-select with Ctrl+click, or rubber-band selection
- Delete selected nodes with the Delete key
- Undo/redo built in (Ctrl+Z / Ctrl+Shift+Z from the keyboard are not wired up in this minimal example, but `editor.undo()` and `editor.redo()` are available)

## Step-by-Step Breakdown

### 1. Create the editor

```tsx
const editor = useFlowEditor()
```

`useFlowEditor()` with no arguments gives you a blank canvas with history enabled (50 undo steps by default). It returns a `FlowEditorAPI` object with everything you need: graph mutations, undo/redo, clipboard, serialization.

### 2. Add nodes programmatically

```tsx
editor.addNode({
  id: crypto.randomUUID(),
  type: 'test/node',
  label: 'New Node',
  position: { x: Math.random() * 400, y: Math.random() * 300 },
  inputs: [{ id: 'in', type: 'exec', label: 'In' }],
  outputs: [{ id: 'out', type: 'exec', label: 'Out' }],
  data: {},
})
```

Each node needs a unique `id`, a `type` string, a `label` for display, a `position`, at least one pin in `inputs` or `outputs`, and a `data` object for custom payload.

### 3. Render the canvas

```tsx
<FlowCanvas store={editor.store} />
```

`FlowCanvas` is a controlled component. It reads from the `GraphStore` and re-renders whenever the graph changes. The default dimensions are `100%` width and `600px` height.

## Adding Undo/Redo Buttons

Extend the minimal example with two toolbar buttons:

```tsx
import { useFlowEditor, FlowCanvas } from '@quantum-studios/flow'

function App() {
  const editor = useFlowEditor({ history: { maxSize: 100 } })

  const addTestNode = () => {
    editor.addNode({
      id: crypto.randomUUID(),
      type: 'test/node',
      label: 'New Node',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      inputs: [{ id: 'in', type: 'exec', label: 'In' }],
      outputs: [{ id: 'out', type: 'exec', label: 'Out' }],
      data: {},
    })
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <div style={{ display: 'flex', gap: 8, padding: 8 }}>
        <button onClick={addTestNode}>Add Node</button>
        <button onClick={() => editor.undo()} disabled={!editor.canUndo}>
          Undo
        </button>
        <button onClick={() => editor.redo()} disabled={!editor.canRedo}>
          Redo
        </button>
      </div>
      <FlowCanvas store={editor.store} />
    </div>
  )
}

export default App
```

## Adding Validation

Prevent invalid connections by passing a `Validator`:

```tsx
import { useFlowEditor, FlowCanvas, Validator } from '@quantum-studios/flow'

function App() {
  const editor = useFlowEditor({
    validator: new Validator([
      Validator.noSelfConnection(),
      Validator.noDuplicateConnection(),
      Validator.typeCompatibility(),
    ]),
  })

  // ... same addTestNode and JSX as above
}
```

With these rules enabled, the canvas will silently reject connections that loop back to the same node, duplicate existing connections, or link incompatible pin types.

## Next Steps

- **[Full Editor Example](/examples/full-editor)** -- a production-style editor with toolbar, node palette, theming, and save/load.
- **[Getting Started](/getting-started)** -- detailed walkthrough of installation and core concepts.
- **[FlowCanvas](/guide/flow-canvas)** -- all canvas props, theming, and interaction reference.
