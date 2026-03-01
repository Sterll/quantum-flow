# Interactive Playground

Try `@quantum-studios/flow` directly in your browser without any local setup. The playground runs on StackBlitz and includes a fully configured editor with node definitions, theming, and undo/redo.

## Live Editor

<iframe src="https://stackblitz.com/edit/quantum-flow-playground?embed=1&file=src/App.tsx" style="width:100%;height:600px;border:0;border-radius:4px;overflow:hidden;" />

::: info Note
The StackBlitz project above is a placeholder. See the [setup instructions](#setting-up-the-stackblitz-project) below to create and publish the actual project.
:::

## What the Playground Includes

The playground project is a minimal Vite + React + TypeScript application with:

- `@quantum-studios/flow` installed as a dependency
- A pre-built editor with a toolbar (undo/redo, save/load)
- Several node definitions (Events, Math, Logic, I/O)
- A node palette sidebar
- Custom dark theme
- Validation rules (no self-connections, no duplicates, type compatibility)

Users can:

- Add nodes from the palette
- Connect pins by dragging
- Undo/redo changes
- Save and load graphs (localStorage)
- Modify the source code live and see changes instantly

## Setting Up the StackBlitz Project

To create the StackBlitz project from scratch, follow these steps.

### 1. Create the project on StackBlitz

Go to [stackblitz.com](https://stackblitz.com) and create a new **Vite + React + TypeScript** project.

### 2. Install the dependency

In the StackBlitz terminal, run:

```sh
npm install @quantum-studios/flow
```

### 3. Replace `src/App.tsx`

Use the following starter code:

```tsx
import { useState } from 'react'
import {
  FlowProvider,
  FlowCanvas,
  useFlowContext,
  Validator,
  defineNode,
} from '@quantum-studios/flow'
import type { FlowTheme, FlowGraph } from '@quantum-studios/flow'

// --- Node Definitions ---

const OnStartNode = defineNode({
  type: 'event/onStart',
  label: 'On Start',
  color: '#e74c3c',
  category: 'Events',
  inputs: [],
  outputs: [{ id: 'exec', type: 'exec', label: '' }],
})

const LogNode = defineNode({
  type: 'io/log',
  label: 'Log',
  color: '#f472b6',
  category: 'I/O',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'message', type: 'string', label: 'Message' },
  ],
  outputs: [{ id: 'exec', type: 'exec', label: '' }],
})

const AddNode = defineNode({
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

const NumberNode = defineNode({
  type: 'math/number',
  label: 'Number',
  color: '#34d399',
  category: 'Math',
  inputs: [],
  outputs: [{ id: 'value', type: 'number', label: 'Value' }],
  defaultData: { value: 0 },
})

const BranchNode = defineNode({
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

const nodeDefinitions = [OnStartNode, LogNode, AddNode, NumberNode, BranchNode]

// --- Theme ---

const theme: FlowTheme = {
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
  connection: { width: 2, opacity: 0.75 },
  selection: { color: '#818cf8' },
}

// --- Toolbar ---

function Toolbar({ selectedIds }: { selectedIds: Set<string> }) {
  const editor = useFlowContext()
  const hasSelection = selectedIds.size > 0

  const handleSave = () => {
    const graph = editor.toJSON()
    localStorage.setItem('playground-graph', JSON.stringify(graph))
    alert('Graph saved!')
  }

  const handleLoad = () => {
    const raw = localStorage.getItem('playground-graph')
    if (raw) {
      editor.fromJSON(JSON.parse(raw) as FlowGraph)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, padding: '6px 12px', background: '#18181b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={() => editor.undo()} disabled={!editor.canUndo}>Undo</button>
      <button onClick={() => editor.redo()} disabled={!editor.canRedo}>Redo</button>
      <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
      <button onClick={() => editor.copy(selectedIds)} disabled={!hasSelection}>Copy</button>
      <button onClick={() => editor.cut(selectedIds)} disabled={!hasSelection}>Cut</button>
      <button onClick={() => editor.paste()} disabled={!editor.canPaste}>Paste</button>
      <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
      <button onClick={handleSave}>Save</button>
      <button onClick={handleLoad}>Load</button>
      <button onClick={() => editor.clear()} style={{ color: '#ef4444' }}>Clear</button>
    </div>
  )
}

// --- Node Palette ---

function NodePalette() {
  const editor = useFlowContext()
  const registry = editor.registry
  if (!registry) return null

  const categories = registry.getCategories()

  return (
    <div style={{ width: 180, background: '#18181b', borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', padding: '8px 0' }}>
      {Array.from(categories.entries()).map(([category, definitions]) => (
        <div key={category} style={{ marginBottom: 8 }}>
          <div style={{ padding: '4px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#52525b' }}>
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
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '5px 12px', border: 'none', background: 'transparent', color: '#d4d4d8', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: def.color ?? '#6b7280' }} />
              {def.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// --- Editor Layout ---

function EditorLayout() {
  const editor = useFlowContext()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#09090b', color: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
      <Toolbar selectedIds={selectedIds} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NodePalette />
        <div style={{ flex: 1 }}>
          <FlowCanvas
            store={editor.store}
            theme={theme}
            snapToGrid={20}
            onSelectionChange={setSelectedIds}
            width="100%"
            height="100%"
          />
        </div>
      </div>
    </div>
  )
}

// --- App ---

export default function App() {
  return (
    <FlowProvider
      validator={new Validator([
        Validator.noSelfConnection(),
        Validator.noDuplicateConnection(),
        Validator.typeCompatibility(),
      ])}
      history={{ maxSize: 100 }}
      registry={nodeDefinitions}
    >
      <EditorLayout />
    </FlowProvider>
  )
}
```

### 4. Clean up default styles

Replace `src/index.css` with:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

button {
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #d4d4d8;
  font-size: 12px;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
```

### 5. Publish and get the embed URL

1. Save the project on StackBlitz
2. Name it `quantum-flow-playground`
3. Copy the URL (e.g., `https://stackblitz.com/edit/quantum-flow-playground`)
4. Append `?embed=1&file=src/App.tsx` for the embed version
5. Update the iframe `src` at the top of this page with the real URL

### Project Structure

```
quantum-flow-playground/
  src/
    App.tsx          -- All-in-one editor (nodes, theme, toolbar, palette)
    main.tsx         -- React entry point
    index.css        -- Minimal reset styles
  index.html
  package.json
  tsconfig.json
  vite.config.ts
```

## Running Locally

If you prefer to run the playground on your machine:

::: code-group

```sh [pnpm]
pnpm create vite playground --template react-ts
cd playground
pnpm add @quantum-studios/flow
```

```sh [npm]
npm create vite@latest playground -- --template react-ts
cd playground
npm install @quantum-studios/flow
```

```sh [yarn]
yarn create vite playground --template react-ts
cd playground
yarn add @quantum-studios/flow
```

:::

Then paste the `App.tsx` code from [step 3](#_3-replace-src-app-tsx) into `src/App.tsx`, start the dev server, and open it in your browser.

## Next Steps

- **[Minimal Example](/examples/minimal)** -- the smallest possible working editor.
- **[Full Editor Example](/examples/full-editor)** -- production-style architecture with separate components.
- **[Getting Started](/getting-started)** -- installation and first steps guide.
