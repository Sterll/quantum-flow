# Full Editor Example

A production-style editor showcasing all major features of `@quantum-studios/flow`: context provider, toolbar with undo/redo/clipboard, node palette with registry, custom theming, selection awareness, and save/load persistence.

## Complete Source

The full example is split into logical sections. You can copy the entire thing into a single file or split it into separate modules.

### Node Definitions

```ts
// nodes.ts
import { defineNode } from '@quantum-studios/flow'

export const OnStartNode = defineNode({
  type: 'event/onStart',
  label: 'On Start',
  color: '#e74c3c',
  category: 'Events',
  inputs: [],
  outputs: [
    { id: 'exec', type: 'exec', label: '' },
  ],
})

export const OnTickNode = defineNode({
  type: 'event/onTick',
  label: 'On Tick',
  color: '#e74c3c',
  category: 'Events',
  inputs: [],
  outputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'delta', type: 'number', label: 'Delta Time' },
  ],
})

export const LogNode = defineNode({
  type: 'io/log',
  label: 'Log',
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

export const AddNode = defineNode({
  type: 'math/add',
  label: 'Add',
  color: '#34d399',
  category: 'Math',
  inputs: [
    { id: 'a', type: 'number', label: 'A' },
    { id: 'b', type: 'number', label: 'B' },
  ],
  outputs: [
    { id: 'result', type: 'number', label: 'Result' },
  ],
})

export const NumberNode = defineNode({
  type: 'math/number',
  label: 'Number',
  color: '#34d399',
  category: 'Math',
  inputs: [],
  outputs: [
    { id: 'value', type: 'number', label: 'Value' },
  ],
  defaultData: { value: 0 },
})

export const CompareNode = defineNode({
  type: 'logic/compare',
  label: 'Compare',
  color: '#fb923c',
  category: 'Logic',
  inputs: [
    { id: 'a', type: 'number', label: 'A' },
    { id: 'b', type: 'number', label: 'B' },
  ],
  outputs: [
    { id: 'result', type: 'boolean', label: 'A > B' },
  ],
})

export const BranchNode = defineNode({
  type: 'logic/branch',
  label: 'Branch',
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

export const StringConcatNode = defineNode({
  type: 'string/concat',
  label: 'Concat',
  color: '#60a5fa',
  category: 'String',
  inputs: [
    { id: 'a', type: 'string', label: 'A' },
    { id: 'b', type: 'string', label: 'B' },
  ],
  outputs: [
    { id: 'result', type: 'string', label: 'Result' },
  ],
})

export const allNodeDefinitions = [
  OnStartNode,
  OnTickNode,
  LogNode,
  AddNode,
  NumberNode,
  CompareNode,
  BranchNode,
  StringConcatNode,
]
```

### Custom Theme

```ts
// theme.ts
import type { FlowTheme } from '@quantum-studios/flow'

export const editorTheme: FlowTheme = {
  canvas: {
    background: '#111114',
    gridColor: 'rgba(255, 255, 255, 0.03)',
  },
  node: {
    titleBar: '#1a1a1e',
    body: '#141416',
    border: 'rgba(255, 255, 255, 0.06)',
    text: '#d4d4d8',
    subtext: '#71717a',
  },
  pin: {
    exec: '#e4e4e7',
    string: '#f472b6',
    number: '#34d399',
    boolean: '#fb923c',
    object: '#60a5fa',
    array: '#c084fc',
  },
  connection: {
    width: 2,
    opacity: 0.75,
  },
  selection: {
    color: '#818cf8',
  },
}
```

### Toolbar Component

```tsx
// Toolbar.tsx
import { useFlowContext } from '@quantum-studios/flow'
import type { FlowGraph } from '@quantum-studios/flow'

interface ToolbarProps {
  selectedIds: Set<string>
}

function Toolbar({ selectedIds }: ToolbarProps) {
  const editor = useFlowContext()
  const hasSelection = selectedIds.size > 0

  const handleSave = () => {
    const graph = editor.toJSON()
    localStorage.setItem('flow-editor-graph', JSON.stringify(graph))
    alert(`Saved ${graph.nodes.length} nodes and ${graph.connections.length} connections.`)
  }

  const handleLoad = () => {
    const raw = localStorage.getItem('flow-editor-graph')
    if (!raw) {
      alert('No saved graph found.')
      return
    }
    const graph: FlowGraph = JSON.parse(raw)
    editor.fromJSON(graph)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: '#18181b',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap',
      }}
    >
      {/* History */}
      <button onClick={() => editor.undo()} disabled={!editor.canUndo}>
        Undo
      </button>
      <button onClick={() => editor.redo()} disabled={!editor.canRedo}>
        Redo
      </button>

      <Separator />

      {/* Clipboard */}
      <button
        onClick={() => editor.copy(selectedIds)}
        disabled={!hasSelection}
      >
        Copy
      </button>
      <button
        onClick={() => editor.cut(selectedIds)}
        disabled={!hasSelection}
      >
        Cut
      </button>
      <button
        onClick={() => editor.paste({ x: 20, y: 20 })}
        disabled={!editor.canPaste}
      >
        Paste
      </button>

      <Separator />

      {/* Persistence */}
      <button onClick={handleSave}>Save</button>
      <button onClick={handleLoad}>Load</button>

      <Separator />

      {/* Danger zone */}
      <button
        onClick={() => {
          if (confirm('Clear the entire graph?')) {
            editor.clear()
          }
        }}
        style={{ color: '#ef4444' }}
      >
        Clear
      </button>

      {/* Status */}
      <span style={{ marginLeft: 'auto', fontSize: 12, color: '#71717a' }}>
        {editor.getNodes().length} nodes
        {hasSelection ? ` | ${selectedIds.size} selected` : ''}
      </span>
    </div>
  )
}

function Separator() {
  return (
    <span
      style={{
        width: 1,
        height: 20,
        background: 'rgba(255,255,255,0.1)',
        margin: '0 4px',
      }}
    />
  )
}
```

### Node Palette Component

```tsx
// NodePalette.tsx
import { useFlowContext } from '@quantum-studios/flow'

function NodePalette() {
  const editor = useFlowContext()
  const registry = editor.registry
  if (!registry) return null

  const categories = registry.getCategories()

  return (
    <div
      style={{
        width: 200,
        background: '#18181b',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#71717a',
        }}
      >
        Node Palette
      </div>

      {Array.from(categories.entries()).map(([category, definitions]) => (
        <div key={category} style={{ marginBottom: 8 }}>
          <div
            style={{
              padding: '6px 12px',
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#52525b',
            }}
          >
            {category}
          </div>

          {definitions.map(def => (
            <button
              key={def.type}
              onClick={() => {
                const node = def.createInstance({
                  x: 200 + Math.random() * 200,
                  y: 100 + Math.random() * 200,
                })
                editor.addNode(node)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 12px',
                border: 'none',
                background: 'transparent',
                color: '#d4d4d8',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')
              }
              onMouseLeave={e =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: def.color ?? '#6b7280',
                  flexShrink: 0,
                }}
              />
              {def.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
```

### Canvas Wrapper

```tsx
// CanvasPanel.tsx
import { FlowCanvas, useFlowContext } from '@quantum-studios/flow'
import type { FlowTheme } from '@quantum-studios/flow'

interface CanvasPanelProps {
  theme: FlowTheme
  onSelectionChange: (ids: Set<string>) => void
}

function CanvasPanel({ theme, onSelectionChange }: CanvasPanelProps) {
  const editor = useFlowContext()

  return (
    <FlowCanvas
      store={editor.store}
      theme={theme}
      snapToGrid={20}
      onSelectionChange={onSelectionChange}
      width="100%"
      height="100%"
    />
  )
}
```

### App Root

```tsx
// App.tsx
import { useState } from 'react'
import { FlowProvider, Validator } from '@quantum-studios/flow'
import { allNodeDefinitions } from './nodes'
import { editorTheme } from './theme'

function App() {
  return (
    <FlowProvider
      validator={new Validator([
        Validator.noSelfConnection(),
        Validator.noDuplicateConnection(),
        Validator.typeCompatibility(),
        Validator.noCycles(),
        Validator.maxConnectionsPerPin(1),
      ])}
      history={{ maxSize: 200 }}
      registry={allNodeDefinitions}
    >
      <EditorLayout />
    </FlowProvider>
  )
}

function EditorLayout() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#09090b',
        color: '#fafafa',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <Toolbar selectedIds={selectedIds} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NodePalette />
        <div style={{ flex: 1, position: 'relative' }}>
          <CanvasPanel
            theme={editorTheme}
            onSelectionChange={setSelectedIds}
          />
        </div>
      </div>
    </div>
  )
}

export default App
```

## Architecture Overview

```
App
 |-- FlowProvider (creates editor, provides context)
      |-- EditorLayout (manages selection state)
           |-- Toolbar (undo/redo, clipboard, save/load)
           |-- NodePalette (registry-driven node list)
           |-- CanvasPanel (FlowCanvas with theme + snap-to-grid)
```

### Key Patterns

**FlowProvider at the root.** Every component that needs the editor API calls `useFlowContext()`. No prop drilling required.

**Selection state lifted to EditorLayout.** The `onSelectionChange` callback on `FlowCanvas` updates a shared `selectedIds` state. Both the toolbar (for enabling/disabling copy/cut) and the canvas use it.

**Node palette from the registry.** `editor.registry.getCategories()` returns a `Map<string, NodeDefinitionWithFactory[]>` grouped by the `category` field. The palette iterates over it to build a categorised list of buttons.

**Toolbar awareness.** The Copy and Cut buttons are disabled when `selectedIds.size === 0`. The Paste button is disabled when `editor.canPaste` is `false`. Undo and Redo are disabled when there is nothing to undo or redo.

**Save and load.** `editor.toJSON()` returns a plain `FlowGraph` object (nodes + connections). `editor.fromJSON(graph)` replaces the entire graph atomically, creating a single undo entry.

## Variations

### Without a Node Palette

If you do not need a categorised palette, you can skip the `registry` option and add nodes manually:

```tsx
function App() {
  return (
    <FlowProvider history={{ maxSize: 100 }}>
      <SimpleEditor />
    </FlowProvider>
  )
}

function SimpleEditor() {
  const editor = useFlowContext()

  const addNode = () => {
    editor.addNode({
      id: crypto.randomUUID(),
      type: 'generic',
      label: 'Node',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      inputs: [{ id: 'in', type: 'exec', label: 'In' }],
      outputs: [{ id: 'out', type: 'exec', label: 'Out' }],
      data: {},
    })
  }

  return (
    <div style={{ height: '100vh' }}>
      <button onClick={addNode}>Add Node</button>
      <FlowCanvas store={editor.store} width="100%" height="100%" />
    </div>
  )
}
```

### With a Light Theme

Swap the theme object for a light color scheme:

```ts
import type { FlowTheme } from '@quantum-studios/flow'

const lightTheme: FlowTheme = {
  canvas: {
    background: '#f8f9fa',
    gridColor: 'rgba(0, 0, 0, 0.06)',
  },
  node: {
    titleBar: '#e9ecef',
    body: '#ffffff',
    border: 'rgba(0, 0, 0, 0.12)',
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
```

Then pass it to `CanvasPanel`:

```tsx
<CanvasPanel theme={lightTheme} onSelectionChange={setSelectedIds} />
```

### With Keyboard Shortcuts

Add keyboard shortcuts for clipboard and undo/redo:

```tsx
import { useEffect, useCallback } from 'react'
import { useFlowContext } from '@quantum-studios/flow'

function useKeyboardShortcuts(selectedIds: Set<string>) {
  const editor = useFlowContext()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) {
              editor.redo()
            } else {
              editor.undo()
            }
            break
          case 'c':
            e.preventDefault()
            editor.copy(selectedIds)
            break
          case 'x':
            e.preventDefault()
            editor.cut(selectedIds)
            break
          case 'v':
            e.preventDefault()
            editor.paste({ x: 20, y: 20 })
            break
        }
      }
    },
    [editor, selectedIds],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
```

Use it in `EditorLayout`:

```tsx
function EditorLayout() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  useKeyboardShortcuts(selectedIds)

  return (
    // ... same layout JSX
  )
}
```

## Next Steps

- **[Interactive Playground](/examples/playground)** -- try the editor live in your browser.
- **[Core Concepts](/guide/concepts)** -- understand the graph model, stores, and event system.
- **[Advanced](/guide/advanced)** -- custom validation rules, batch operations, and direct store access.
