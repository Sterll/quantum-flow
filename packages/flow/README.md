# @quantum-studios/flow

Headless Canvas 2D node editor for React. Blueprint-style visual scripting with TypeScript-first APIs, zero runtime dependencies beyond React.

## Features

- **Canvas 2D rendering** - high-performance rendering for 500+ nodes
- **Blueprint-style** - exec pins + data pins, Unreal Engine inspired
- **TypeScript-first** - full type safety, exported types for everything
- **Headless architecture** - bring your own UI, or use the built-in `FlowCanvas`
- **Node groups** - visual frames that move children together
- **Reroute waypoints** - double-click connections to add control points
- **Undo/redo** - built-in history with batch-aware snapshots
- **Clipboard** - copy/cut/paste nodes and connections
- **Validation** - composable rules (no cycles, type checking, max connections)
- **Search palette** - Ctrl+K fuzzy search to add nodes
- **Export image** - export canvas as PNG
- **Touch support** - mobile-friendly interactions
- **Minimap** - overview with click-to-navigate
- **Zero dependencies** - only React as peer dependency

## Install

```bash
npm install @quantum-studios/flow
```

## Quick Start

### Option 1: High-level (FlowProvider)

```tsx
import { FlowProvider, useFlowContext, FlowCanvas, defineNode } from '@quantum-studios/flow'

const MathAdd = defineNode({
  type: 'math-add',
  label: 'Add',
  inputs: [
    { id: 'a', label: 'A', type: 'data', dataType: 'number' },
    { id: 'b', label: 'B', type: 'data', dataType: 'number' },
  ],
  outputs: [
    { id: 'sum', label: 'Sum', type: 'data', dataType: 'number' },
  ],
})

function Editor() {
  const { store } = useFlowContext()
  return <FlowCanvas store={store} width={800} height={600} />
}

function App() {
  return (
    <FlowProvider registry={[MathAdd]}>
      <Editor />
    </FlowProvider>
  )
}
```

### Option 2: Low-level (GraphStore)

```tsx
import { GraphStore, FlowCanvas, Validator, HistoryManager } from '@quantum-studios/flow'
import { useRef } from 'react'

function App() {
  const storeRef = useRef(new GraphStore())
  const store = storeRef.current

  store.addNode({
    id: 'node-1',
    type: 'start',
    label: 'Start',
    position: { x: 100, y: 100 },
    inputs: [],
    outputs: [{ id: 'exec', label: '', type: 'exec' }],
    data: {},
  })

  return <FlowCanvas store={store} width={800} height={600} />
}
```

## Node Definitions

```ts
import { defineNode } from '@quantum-studios/flow'

const PrintNode = defineNode({
  type: 'print',
  label: 'Print',
  category: 'Debug',
  color: '#e74c3c',
  inputs: [
    { id: 'exec-in', label: '', type: 'exec' },
    { id: 'message', label: 'Message', type: 'data', dataType: 'string' },
  ],
  outputs: [
    { id: 'exec-out', label: '', type: 'exec' },
  ],
  defaultData: { message: 'Hello' },
})

// Create an instance
const node = PrintNode.createInstance({ x: 200, y: 150 })
```

## Validation

```ts
import { Validator, noSelfConnection, noCycles, typeCompatibility } from '@quantum-studios/flow'

const validator = new Validator()
validator.addRule(noSelfConnection())
validator.addRule(noCycles())
validator.addRule(typeCompatibility())

// Pass to GraphStore or FlowProvider
<FlowProvider validator={validator} registry={[...]} />
```

## API Overview

### Model

| Export | Description |
|--------|-------------|
| `GraphStore` | Core state container for nodes and connections |
| `EventBus` | Typed event system for graph mutations |
| `Validator` | Composable validation pipeline |
| `HistoryManager` | Undo/redo with batch support |

### Define

| Export | Description |
|--------|-------------|
| `defineNode()` | Create node type blueprints |
| `NodeRegistry` | Register and query node types |

### Hooks

| Export | Description |
|--------|-------------|
| `useViewport` | Pan, zoom, fit-to-content |
| `useNodeDrag` | Drag nodes with snap |
| `useConnection` | Create connections by dragging |
| `useSelection` | Click and rubber-band selection |
| `useHotkeys` | Keyboard shortcuts |
| `useCanvasInteraction` | All-in-one interaction hook |

### React

| Export | Description |
|--------|-------------|
| `useFlowEditor` | Complete editor API in one hook |
| `FlowProvider` | React context provider |
| `useFlowContext` | Access editor from any child |
| `useClipboard` | Copy/cut/paste |

### Components

| Export | Description |
|--------|-------------|
| `FlowCanvas` | Canvas 2D renderer |
| `Minimap` | Overview with navigation |
| `SearchPalette` | Ctrl+K node search |
| `FlowContextMenu` | Right-click menu |

## License

MIT
