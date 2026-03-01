# Getting Started

Build a visual node editor in React with just a few lines of code.
`@quantum-studios/flow` provides a headless, canvas-based editor with
built-in undo/redo, clipboard, validation, and a node registry -- all fully
typed in TypeScript.

## Installation

::: code-group

```sh [pnpm]
pnpm add @quantum-studios/flow
```

```sh [npm]
npm install @quantum-studios/flow
```

```sh [yarn]
yarn add @quantum-studios/flow
```

:::

::: warning Peer dependency
`@quantum-studios/flow` requires **React 18 or later** as a peer dependency.
Make sure it is already installed in your project.
:::

## Quick Start

The fastest way to get a working editor on screen: call `useFlowEditor` and
pass its `store` to `FlowCanvas`.

```tsx
import { useFlowEditor, FlowCanvas } from '@quantum-studios/flow'

function App() {
  const editor = useFlowEditor()
  return <FlowCanvas store={editor.store} width="100%" height={600} />
}
```

That is all you need. The canvas is interactive out of the box: pan, zoom,
select nodes, and create connections by dragging between pins.

::: tip
`useFlowEditor()` accepts no arguments for a blank canvas, or you can pass an
`initialGraph` to restore a previously saved graph.
:::

## With Undo / Redo

History is enabled by default. The editor exposes `undo`, `redo`, `canUndo`,
and `canRedo` so you can wire up toolbar buttons in a single line each.

```tsx
import { useFlowEditor, FlowCanvas } from '@quantum-studios/flow'

function App() {
  const editor = useFlowEditor({ history: { maxSize: 100 } })

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: 8 }}>
        <button disabled={!editor.canUndo} onClick={() => editor.undo()}>
          Undo
        </button>
        <button disabled={!editor.canRedo} onClick={() => editor.redo()}>
          Redo
        </button>
        <button onClick={() => console.log(editor.toJSON())}>
          Export JSON
        </button>
      </div>
      <FlowCanvas store={editor.store} width="100%" height={600} />
    </div>
  )
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `history` | `boolean \| { maxSize?: number }` | `true` | Enable history and optionally cap the undo stack size. |

::: info
Set `history: false` to disable undo/redo entirely and save a small amount of
memory.
:::

## With Node Registry

For real-world editors you will want to define reusable node types. Use
`defineNode` to declare each type, then pass the definitions to `useFlowEditor`
via the `registry` option.

### 1. Define your nodes

```ts
// nodes.ts
import { defineNode } from '@quantum-studios/flow'

export const OnPlayerConnect = defineNode({
  type: 'event/onPlayerConnect',
  label: 'On Player Connect',
  category: 'Events',
  color: '#e74c3c',
  inputs: [],
  outputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'player', type: 'string', label: 'Player' },
  ],
})

export const SendMessage = defineNode({
  type: 'action/sendMessage',
  label: 'Send Message',
  category: 'Actions',
  color: '#3498db',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'target', type: 'string', label: 'Target' },
    { id: 'message', type: 'string', label: 'Message' },
  ],
  outputs: [
    { id: 'exec', type: 'exec', label: '' },
  ],
})
```

Each call to `defineNode` returns a `NodeDefinitionWithFactory` -- the original
definition enriched with a `createInstance(position, overrides?)` method that
stamps out a ready-to-use `FlowNode` with a unique id.

### 2. Register and use

```tsx
// App.tsx
import { useFlowEditor, FlowCanvas } from '@quantum-studios/flow'
import { OnPlayerConnect, SendMessage } from './nodes'

const nodeTypes = [OnPlayerConnect, SendMessage]

function App() {
  const editor = useFlowEditor({ registry: nodeTypes })

  const addEvent = () => {
    const node = OnPlayerConnect.createInstance({ x: 100, y: 100 })
    editor.addNode(node)
  }

  const addAction = () => {
    const node = SendMessage.createInstance({ x: 400, y: 100 })
    editor.addNode(node)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: 8 }}>
        <button onClick={addEvent}>+ Event</button>
        <button onClick={addAction}>+ Action</button>
      </div>
      <FlowCanvas store={editor.store} width="100%" height={600} />
    </div>
  )
}
```

::: tip
The `NodeRegistry` created by `useFlowEditor` is available at
`editor.registry`. You can call `editor.registry.get(type)` to look up a
definition at runtime, or `editor.registry.getCategories()` to build a
categorised node palette.
:::

## Next Steps

You now have a working node editor with undo/redo and typed nodes. Here is
where to go from here:

- **[Core Concepts](/guide/concepts)** -- understand the graph model, stores,
  and event system.
- **[FlowCanvas](/guide/flow-canvas)** -- theming, snap-to-grid, read-only
  mode, and selection events.
- **[React Hooks](/guide/react-hooks)** -- `useFlowEditor`, `useGraphStore`,
  `useHistory`, and friends.
- **[API Reference](/api/hooks)** -- full type signatures for every hook,
  component, and utility.
- **[Examples](/examples/minimal)** -- copy-paste examples from minimal to
  full-featured editors.
