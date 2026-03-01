# Components Reference

Complete API reference for all React components exported by `@quantum-studios/flow`.

## FlowCanvas {#flowcanvas}

The visual canvas that renders nodes, connections, and handles all user interaction on an HTML5 Canvas 2D surface. It is a controlled component that reads from a `GraphStore` instance.

### Import

```typescript
import { FlowCanvas } from '@quantum-studios/flow'
```

### Signature

```typescript
function FlowCanvas(props: FlowCanvasProps): JSX.Element
```

### Props — `FlowCanvasProps`

```typescript
interface FlowCanvasProps {
  store: GraphStore
  theme?: FlowTheme
  readOnly?: boolean
  snapToGrid?: number
  onSelectionChange?: (ids: Set<string>) => void
  width?: number | string
  height?: number | string
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `store` | `GraphStore` | **required** | The graph store to render and interact with |
| `theme` | [`FlowTheme`](/api/types#flowtheme) | Dark theme | Visual customization (colors, sizes, pin colors) |
| `readOnly` | `boolean` | `false` | Disables all interactions (drag, connect, delete). Pan and zoom remain active. |
| `snapToGrid` | `number` | `undefined` | Snap node positions to a grid of this size in pixels |
| `onSelectionChange` | `(ids: Set<string>) => void` | `undefined` | Callback fired when the set of selected node IDs changes |
| `width` | `number \| string` | `'100%'` | Canvas width. Accepts a CSS string or a number (interpreted as pixels). |
| `height` | `number \| string` | `'600px'` | Canvas height. Accepts a CSS string or a number (interpreted as pixels). |

### Props Detail

#### store

The `GraphStore` instance that the canvas reads from on every animation frame. Pass the `store` from `useFlowEditor()` or create one with `useGraphStore()`.

```tsx
const editor = useFlowEditor()
<FlowCanvas store={editor.store} />
```

#### theme

Overrides the built-in dark theme. All fields are optional -- unset values fall back to defaults. See [`FlowTheme`](/api/types#flowtheme) for the full interface and default values.

```tsx
<FlowCanvas store={store} theme={{ canvas: { background: '#1a1a2e' } }} />
```

#### readOnly

When `true`, the canvas becomes a pure viewer. Users can still pan and zoom to explore the graph, but drag, connect, and delete actions are disabled.

```tsx
<FlowCanvas store={store} readOnly />
```

#### snapToGrid

Constrains node positions to a grid. The value is the grid cell size in pixels.

```tsx
<FlowCanvas store={store} snapToGrid={20} />
```

#### onSelectionChange

Fires whenever the selected nodes change (click, rubber-band selection, Ctrl+A, Delete). Returns a `Set<string>` of the currently selected node IDs.

```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
<FlowCanvas store={store} onSelectionChange={setSelectedIds} />
```

#### width / height

Controls the canvas dimensions. Accepts CSS strings or numbers (interpreted as pixels). The canvas uses a `ResizeObserver` internally to adapt to container size changes.

```tsx
<FlowCanvas store={store} width="100%" height="100vh" />
<FlowCanvas store={store} width={800} height={600} />
```

::: warning
When using percentage-based dimensions, ensure the parent element has an explicit size. A parent `<div>` with no height collapses to 0, making the canvas invisible.
:::

### Example

```tsx
import { useFlowEditor, FlowCanvas } from '@quantum-studios/flow'

function Editor() {
  const editor = useFlowEditor()
  return (
    <FlowCanvas
      store={editor.store}
      snapToGrid={20}
      onSelectionChange={(ids) => console.log('Selected:', ids)}
      width="100%"
      height="80vh"
    />
  )
}
```

---

## FlowProvider {#flowprovider}

A React context provider that wraps `useFlowEditor` internally and makes the resulting `FlowEditorAPI` available to all descendant components via `useFlowContext()`.

### Import

```typescript
import { FlowProvider } from '@quantum-studios/flow'
```

### Signature

```typescript
function FlowProvider({ children, ...options }: FlowProviderProps): JSX.Element
```

### Props — `FlowProviderProps`

`FlowProviderProps` extends `UseFlowEditorOptions` with a `children` prop.

```typescript
interface FlowProviderProps extends UseFlowEditorOptions {
  children: React.ReactNode
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialGraph` | `FlowGraph` | `{ nodes: [], connections: [] }` | Pre-populate the editor with an existing graph |
| `validator` | `Validator` | `undefined` | Validation rules applied before every mutation |
| `history` | `boolean \| { maxSize?: number }` | `true` | Enable undo/redo. Pass `false` to disable, or `{ maxSize }` to cap the stack. |
| `registry` | `NodeDefinitionWithFactory[]` | `undefined` | Node definitions to register (built with `defineNode()`) |
| `children` | `React.ReactNode` | **required** | Child components that can access the editor via `useFlowContext()` |

### Example

```tsx
import { FlowProvider, FlowCanvas, useFlowContext, Validator } from '@quantum-studios/flow'

function App() {
  return (
    <FlowProvider
      validator={new Validator([Validator.noSelfConnection()])}
      history={{ maxSize: 100 }}
    >
      <Toolbar />
      <Canvas />
    </FlowProvider>
  )
}

function Toolbar() {
  const editor = useFlowContext()
  return <button onClick={() => editor.undo()} disabled={!editor.canUndo}>Undo</button>
}

function Canvas() {
  const { store } = useFlowContext()
  return <FlowCanvas store={store} />
}
```

### Multiple Providers

You can nest multiple `FlowProvider` instances to create independent editors. Each provider creates its own isolated `GraphStore`, `HistoryManager`, and clipboard buffer.

```tsx
<FlowProvider initialGraph={graphA}>
  <EditorA />
</FlowProvider>
<FlowProvider initialGraph={graphB}>
  <EditorB />
</FlowProvider>
```

::: tip
`FlowProvider` creates the editor once at mount time. Changes to props after mount are ignored, just like `useFlowEditor`.
:::
