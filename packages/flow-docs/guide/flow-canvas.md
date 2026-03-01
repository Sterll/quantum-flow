# FlowCanvas Component

`FlowCanvas` is the visual heart of the editor. It renders nodes, connections, and handles all user interaction on an HTML5 Canvas 2D surface. It is a controlled component that reads from a `GraphStore` instance.

## Basic Usage

```tsx
import { useFlowEditor, FlowCanvas } from '@quantum-studios/flow'

function Editor() {
  const { store } = useFlowEditor()

  return <FlowCanvas store={store} />
}
```

The canvas repaints automatically whenever the store emits events (node added, moved, connected, etc.). You do not need to trigger re-renders manually.

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `store` | `GraphStore` | **required** | The graph store to render and interact with |
| `theme` | `FlowTheme` | Dark theme | Visual customization (colors, sizes) |
| `readOnly` | `boolean` | `false` | Disables all interactions (drag, connect, delete) |
| `snapToGrid` | `number` | `undefined` | Snap node positions to a grid of this size (in px) |
| `onSelectionChange` | `(ids: Set<string>) => void` | `undefined` | Callback when the set of selected nodes changes |
| `width` | `number \| string` | `'100%'` | Canvas width (CSS value or number in px) |
| `height` | `number \| string` | `'600px'` | Canvas height (CSS value or number in px) |

### store

The `GraphStore` instance that the canvas reads from. Pass the `store` returned by `useFlowEditor()` or create one manually with `useGraphStore()`.

```tsx
const editor = useFlowEditor({ history: true })
<FlowCanvas store={editor.store} />
```

### readOnly

When `true`, the canvas becomes a pure viewer. Users can still pan and zoom, but cannot drag nodes, create connections, or delete elements.

```tsx
<FlowCanvas store={store} readOnly />
```

### snapToGrid

Constrains node positions to a grid. The value is the grid cell size in pixels.

```tsx
// Nodes snap to a 20px grid
<FlowCanvas store={store} snapToGrid={20} />
```

### onSelectionChange

Fires whenever the selected nodes change (click, rubber-band, Ctrl+A, Delete). Use this to build inspector panels or toolbars that react to selection.

```tsx
function Editor() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const editor = useFlowEditor()

  return (
    <div style={{ display: 'flex' }}>
      <FlowCanvas
        store={editor.store}
        onSelectionChange={setSelectedIds}
        width="70%"
        height="100vh"
      />
      <InspectorPanel
        nodeIds={selectedIds}
        store={editor.store}
      />
    </div>
  )
}
```

### width / height

Controls the canvas dimensions. Accepts CSS strings or numbers (interpreted as pixels).

```tsx
// Fill the parent container
<FlowCanvas store={store} width="100%" height="100%" />

// Fixed dimensions
<FlowCanvas store={store} width={800} height={600} />
```

## Theming

The `FlowCanvas` ships with a dark theme inspired by the Claude Terminal workflow engine. You can customize every visual aspect through the `FlowTheme` interface.

### FlowTheme Interface

```typescript
interface FlowTheme {
  canvas?: {
    background?: string   // Canvas background color
    gridColor?: string    // Grid line color
  }
  node?: {
    titleBar?: string     // Title bar background
    body?: string         // Node body background
    border?: string       // Node border color
    text?: string         // Title text color
    subtext?: string      // Secondary text color
  }
  pin?: {
    exec?: string         // Exec pin color (diamond shape)
    string?: string       // String pin color
    number?: string       // Number pin color
    boolean?: string      // Boolean pin color
    object?: string       // Object pin color
    array?: string        // Array pin color
    [key: string]: string | undefined  // Custom pin types
  }
  connection?: {
    width?: number        // Wire stroke width (px)
    opacity?: number      // Wire opacity (0-1)
  }
  selection?: {
    color?: string        // Selection highlight color
  }
}
```

### Default Theme Values

The built-in dark theme uses these defaults:

```typescript
const defaultTheme: FlowTheme = {
  canvas: {
    background: '#0a0a0a',
    gridColor: 'rgba(255,255,255,0.03)',
  },
  node: {
    titleBar: '#141416',
    body: '#101012',
    border: 'rgba(255,255,255,0.04)',
    text: '#bbb',
    subtext: '#888',
  },
  pin: {
    exec: '#ffffff',
    string: '#f472b6',
    number: '#34d399',
    boolean: '#fb923c',
    object: '#60a5fa',
    array: '#c084fc',
  },
  connection: {
    width: 2,
    opacity: 0.7,
  },
  selection: {
    color: '#60a5fa',
  },
}
```

### Custom Theme Example

::: code-group

```tsx [Light Theme]
const lightTheme: FlowTheme = {
  canvas: {
    background: '#f8f9fa',
    gridColor: 'rgba(0,0,0,0.06)',
  },
  node: {
    titleBar: '#e9ecef',
    body: '#ffffff',
    border: 'rgba(0,0,0,0.12)',
    text: '#212529',
    subtext: '#6c757d',
  },
  pin: {
    exec: '#495057',
    string: '#e91e8c',
    number: '#0ca678',
    boolean: '#f08c00',
    object: '#4263eb',
    array: '#7950f2',
  },
  connection: {
    width: 2,
    opacity: 0.6,
  },
  selection: {
    color: '#4263eb',
  },
}

<FlowCanvas store={store} theme={lightTheme} />
```

```tsx [Solarized]
const solarizedTheme: FlowTheme = {
  canvas: {
    background: '#002b36',
    gridColor: 'rgba(131,148,150,0.08)',
  },
  node: {
    titleBar: '#073642',
    body: '#002b36',
    border: 'rgba(131,148,150,0.15)',
    text: '#93a1a1',
    subtext: '#657b83',
  },
  pin: {
    exec: '#fdf6e3',
    string: '#d33682',
    number: '#2aa198',
    boolean: '#cb4b16',
    object: '#268bd2',
    array: '#6c71c4',
  },
  selection: {
    color: '#268bd2',
  },
}

<FlowCanvas store={store} theme={solarizedTheme} />
```

:::

### Custom Pin Type Colors

If you use custom pin types (beyond the built-in `exec`, `string`, `number`, `boolean`, `object`, `array`), you can assign colors to them in the `pin` section:

```tsx
const theme: FlowTheme = {
  pin: {
    // Built-in types (override defaults)
    string: '#ff6b9d',
    // Custom types
    audio: '#ff9f43',
    texture: '#00d2d3',
    material: '#5f27cd',
  },
}
```

Any pin type not found in the theme falls back to the default gray (`#6b7280`).

## Interaction

`FlowCanvas` handles all user interaction internally. Here is a complete reference of the supported interactions.

### Navigation

| Action | Input | Description |
|--------|-------|-------------|
| **Pan** | Right-click + drag | Moves the viewport |
| **Zoom** | Mouse wheel | Zooms in/out centered on the cursor |

### Selection

| Action | Input | Description |
|--------|-------|-------------|
| **Select node** | Left-click on node | Selects a single node (clears previous selection) |
| **Multi-select** | Ctrl + left-click on node | Toggles a node in/out of the selection |
| **Rubber-band** | Left-click + drag on empty space | Selects all nodes within the rectangle |
| **Select all** | `Ctrl+A` | Selects every node in the graph |
| **Deselect** | Left-click on empty space | Clears the selection |

### Node Manipulation

| Action | Input | Description |
|--------|-------|-------------|
| **Drag node** | Left-click + drag on node title | Moves the node (or all selected nodes) |
| **Delete** | `Delete` key | Removes all selected nodes and their connections |

### Connections

| Action | Input | Description |
|--------|-------|-------------|
| **Create connection** | Left-click + drag from a pin | Drags a wire from an output/input pin to another compatible pin |
| **Cancel connection** | Release on empty space | Cancels the in-progress connection |

::: tip
Connections are drawn as smooth bezier curves. During a drag, a dashed preview wire follows the cursor. The wire becomes solid once the connection is established.
:::

### Visual Indicators

- **Connected pins** are filled (circles for data pins, filled diamonds for exec pins)
- **Unconnected pins** are hollow outlines
- **Selected nodes** show a glowing border in the selection color
- **Pin labels** display the pin name and its type below (except for exec pins)
- **Node accent color** appears as a thin line at the top of the title bar and as a subtle gradient in the body

## Responsive Layout

The canvas automatically adapts to its container's size using a `ResizeObserver`. You do not need to handle resize events manually.

```tsx
// The canvas fills whatever space is available
<div style={{ width: '100%', height: '100vh' }}>
  <FlowCanvas store={store} />
</div>
```

::: warning
When using percentage-based dimensions, make sure the parent element has an explicit size. A `<div>` with no height will collapse to 0, and the canvas will not be visible.
:::

## Read-Only Mode

Use `readOnly` for preview or documentation scenarios where the user should see the graph but not modify it.

```tsx
function GraphPreview({ graph }: { graph: FlowGraph }) {
  const { store } = useFlowEditor({ initialGraph: graph })

  return (
    <FlowCanvas
      store={store}
      readOnly
      width="100%"
      height={400}
    />
  )
}
```

In read-only mode, pan and zoom still work so users can explore the graph, but drag, connect, and delete actions are disabled.
