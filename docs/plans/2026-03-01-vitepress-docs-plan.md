# VitePress Documentation Site Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a full VitePress documentation site for `@quantum-studios/flow` with guides, API reference, examples, and playground.

**Architecture:** New `packages/flow-docs/` package in the pnpm monorepo. VitePress generates a static site. Content is Markdown with embedded TypeScript code blocks. The site covers getting started, conceptual guides, detailed API reference, and interactive examples via StackBlitz embeds.

**Tech Stack:** VitePress 1.x, pnpm monorepo, TypeScript, Markdown

---

### Task 1: Scaffold VitePress package

**Files:**
- Create: `packages/flow-docs/package.json`
- Create: `packages/flow-docs/.vitepress/config.ts`
- Modify: `pnpm-workspace.yaml` (add flow-docs if needed)

**Step 1: Create package.json**

```json
{
  "name": "@quantum-studios/flow-docs",
  "private": true,
  "scripts": {
    "dev": "vitepress dev",
    "build": "vitepress build",
    "preview": "vitepress preview"
  },
  "devDependencies": {
    "vitepress": "^1.6.3"
  }
}
```

**Step 2: Create VitePress config**

```typescript
// packages/flow-docs/.vitepress/config.ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '@quantum-studios/flow',
  description: 'Headless node editor for React — Canvas-based, TypeScript-first',
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Guide', link: '/guide/concepts' },
      { text: 'API', link: '/api/hooks' },
      { text: 'Examples', link: '/examples/minimal' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Core Concepts', link: '/guide/concepts' },
            { text: 'FlowCanvas', link: '/guide/flow-canvas' },
            { text: 'React Hooks', link: '/guide/react-hooks' },
            { text: 'Clipboard', link: '/guide/clipboard' },
            { text: 'Context Provider', link: '/guide/context-provider' },
            { text: 'Advanced', link: '/guide/advanced' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Hooks', link: '/api/hooks' },
            { text: 'Types', link: '/api/types' },
            { text: 'Components', link: '/api/components' },
            { text: 'Model', link: '/api/model' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Minimal', link: '/examples/minimal' },
            { text: 'Full Editor', link: '/examples/full-editor' },
            { text: 'Playground', link: '/examples/playground' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Sterll/Quantum-Flow-Lib' },
    ],
    search: {
      provider: 'local',
    },
  },
})
```

**Step 3: Ensure pnpm workspace includes flow-docs**

Check `pnpm-workspace.yaml` at root. If it uses `packages/*` glob, it's already covered. If not, add `packages/flow-docs`.

**Step 4: Install dependencies**

Run: `cd packages/flow-docs && pnpm install`

**Step 5: Create empty index.md to verify it works**

```markdown
---
layout: home
hero:
  name: '@quantum-studios/flow'
  text: Headless Node Editor for React
  tagline: Canvas-based, TypeScript-first, fully composable
  actions:
    - theme: brand
      text: Getting Started
      link: /getting-started
    - theme: alt
      text: API Reference
      link: /api/hooks
---
```

**Step 6: Verify dev server starts**

Run: `pnpm --filter @quantum-studios/flow-docs dev`
Expected: VitePress dev server starts, landing page visible at localhost:5173

**Step 7: Commit**

```
docs(flow): scaffold VitePress documentation site
```

---

### Task 2: Getting Started page

**Files:**
- Create: `packages/flow-docs/getting-started.md`

**Content outline:**

The page must cover:
1. **Installation** — `pnpm add @quantum-studios/flow` with peer dep `react >=18`
2. **Quick Start** — minimal useFlowEditor + FlowCanvas example (10 lines)
3. **With Undo/Redo** — add undo/redo buttons
4. **With Node Registry** — defineNode + registry option
5. **Next Steps** — links to Guide and API

**Key code examples to include:**

Minimal:
```tsx
import { useFlowEditor, FlowCanvas } from '@quantum-studios/flow'

function App() {
  const editor = useFlowEditor()
  return <FlowCanvas store={editor.store} />
}
```

With toolbar:
```tsx
const editor = useFlowEditor({ history: { maxSize: 100 } })

return (
  <>
    <button disabled={!editor.canUndo} onClick={editor.undo}>Undo</button>
    <button disabled={!editor.canRedo} onClick={editor.redo}>Redo</button>
    <button onClick={() => console.log(editor.toJSON())}>Export</button>
    <FlowCanvas store={editor.store} />
  </>
)
```

**Step 1: Write the page**

Write complete Markdown with all 5 sections, code blocks, and tip callouts.

**Step 2: Verify** — `pnpm --filter @quantum-studios/flow-docs dev`, navigate to /getting-started

**Step 3: Commit**

```
docs(flow): add Getting Started page
```

---

### Task 3: Guide pages

**Files:**
- Create: `packages/flow-docs/guide/concepts.md`
- Create: `packages/flow-docs/guide/flow-canvas.md`
- Create: `packages/flow-docs/guide/react-hooks.md`
- Create: `packages/flow-docs/guide/clipboard.md`
- Create: `packages/flow-docs/guide/context-provider.md`
- Create: `packages/flow-docs/guide/advanced.md`

**Content for each page:**

#### concepts.md — Core Concepts
- Architecture diagram (text): Store → Events → Hooks → Canvas
- **GraphStore** — central state, nodes + connections, event-driven mutations
- **EventBus** — typed event system, subscribe/unsubscribe
- **Validator** — composable rules, runs before mutations
- **HistoryManager** — auto-subscribe, undo/redo stacks, batch support
- **NodeRegistry** — define reusable node types with `defineNode`

#### flow-canvas.md — FlowCanvas Component
- Props reference (store, theme, readOnly, snapToGrid, onSelectionChange, width, height)
- Theming with `FlowTheme` — canvas, node, pin, connection, selection colors
- Full theme example
- Interaction: pan (right-click), zoom (wheel), select (click/rubber-band), connect (drag pin), hotkeys (Delete, Ctrl+A)

#### react-hooks.md — React Hooks
- `useFlowEditor` — the all-in-one hook, all options explained
- `useGraphStore` — when to use individually (advanced cases)
- `useHistory` — reactive canUndo/canRedo, maxSize
- Comparison table: useFlowEditor vs individual hooks

#### clipboard.md — Clipboard
- `useClipboard` standalone hook
- copy/cut/paste via FlowEditorAPI
- Internal connections remapped, external connections dropped
- Custom offset on paste
- Integration with selection (copy selected nodes)

#### context-provider.md — Context Provider
- `FlowProvider` wraps `useFlowEditor`
- `useFlowContext` accesses the editor from any child
- Example: Toolbar + Canvas + Inspector all using context
- When to use provider vs prop drilling

#### advanced.md — Advanced
- Custom validation rules with `Validator`
- Node definitions with `defineNode` + `NodeRegistry`
- Batch operations for grouped undo/redo
- Direct GraphStore access for advanced operations
- Building custom interaction hooks with `useCanvasInteraction`

**Step 1: Write all 6 guide pages**

**Step 2: Verify** — dev server, navigate each page, check sidebar works

**Step 3: Commit**

```
docs(flow): add guide pages (concepts, canvas, hooks, clipboard, provider, advanced)
```

---

### Task 4: API Reference pages

**Files:**
- Create: `packages/flow-docs/api/hooks.md`
- Create: `packages/flow-docs/api/types.md`
- Create: `packages/flow-docs/api/components.md`
- Create: `packages/flow-docs/api/model.md`

**Content format:** Each export gets a section with signature, description, parameters table, return type, and example.

#### hooks.md — Hooks API Reference

Document each hook with full TypeScript signatures:

- **useFlowEditor(options?)** — `UseFlowEditorOptions` → `FlowEditorAPI`
  - All 48 options and returned members documented
- **useGraphStore(options?)** — `UseGraphStoreOptions` → `GraphStore`
- **useHistory(store, options?)** — `UseHistoryOptions` → `UseHistoryAPI`
- **useClipboard(store)** → `UseClipboardAPI`
- **useFlowContext()** → `FlowEditorAPI`

For each: signature block, options table (param | type | default | description), return table, one-liner example.

#### types.md — Types Reference

All exported types with their fields:

- `FlowNode` — id, type, label, position, inputs, outputs, data, width?, color?
- `FlowPin` — id, type (PinType), label, optional?, defaultValue?
- `PinType` — 'exec' | 'string' | 'number' | 'boolean' | 'object' | 'array' | custom string
- `FlowConnection` — id, fromNodeId, fromPinId, toNodeId, toPinId
- `FlowGraph` — nodes: FlowNode[], connections: FlowConnection[]
- `FlowNodePosition` — x, y
- `FlowTheme` — canvas, node, pin, connection, selection sub-objects
- `NodeDefinition` / `NodeDefinitionWithFactory`

#### components.md — Components Reference

- **FlowCanvas** — all props documented with types and defaults
- **FlowProvider** — props (extends UseFlowEditorOptions + children)

#### model.md — Model Reference

- **GraphStore** — constructor, all public methods, events property
- **EventBus<T>** — on, off, emit, once
- **Validator** — addRule, removeRule, validate
- **HistoryManager** — constructor, undo, redo, canUndo, canRedo, clear, getUndoStack, getRedoStack
- **NodeRegistry** — register, registerMany, unregister, has, get, getAll, getByNamespace, getCategories

**Step 1: Write all 4 API reference pages**

**Step 2: Verify** — dev server, check each page renders, code blocks formatted

**Step 3: Commit**

```
docs(flow): add API reference pages (hooks, types, components, model)
```

---

### Task 5: Examples pages

**Files:**
- Create: `packages/flow-docs/examples/minimal.md`
- Create: `packages/flow-docs/examples/full-editor.md`
- Create: `packages/flow-docs/examples/playground.md`

#### minimal.md — Minimal Example

Complete copy-pasteable example:
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
```

#### full-editor.md — Full Editor Example

Complete example with:
- FlowProvider wrapping everything
- Toolbar component with Undo/Redo/Copy/Paste/Clear/Save buttons
- FlowCanvas with custom theme
- Node palette using registry + defineNode
- Selection-aware toolbar (copy/cut disabled when nothing selected)
- Save/Load with toJSON/fromJSON

#### playground.md — Interactive Playground

StackBlitz embed:
```markdown
<iframe src="https://stackblitz.com/edit/quantum-flow-playground?embed=1&file=src/App.tsx" style="width:100%;height:600px;border:0;border-radius:4px;overflow:hidden;" />
```

Note: the StackBlitz project would need to be created separately. For now, include a placeholder with instructions on how to set it up.

**Step 1: Write all 3 example pages**

**Step 2: Verify** — dev server, check each page

**Step 3: Commit**

```
docs(flow): add example pages (minimal, full-editor, playground)
```

---

### Task 6: Extra pages (contributing, changelog, FAQ)

**Files:**
- Create: `packages/flow-docs/contributing.md`
- Create: `packages/flow-docs/changelog.md`
- Create: `packages/flow-docs/faq.md`

#### contributing.md
- Prerequisites (Node 20+, pnpm)
- Clone & install
- Development workflow (dev, test, build, storybook)
- Project structure overview
- PR guidelines
- Code style (TypeScript, no default exports, useCallback for hook returns)

#### changelog.md
- v0.1.0 — Initial release
  - Model layer: GraphStore, EventBus, Validator, HistoryManager
  - Define layer: defineNode, NodeRegistry
  - Interaction hooks: useViewport, useNodeDrag, useConnection, useSelection, useHotkeys, useCanvasInteraction
  - React API: useFlowEditor, useGraphStore, useHistory, useClipboard
  - Components: FlowCanvas, FlowProvider
  - 140 tests

#### faq.md
- How to add custom pin types?
- How to validate connections (type checking)?
- How to customize node rendering? (headless lib — render your own UI on top)
- Can I use this without React? (Model layer is framework-agnostic)
- How to persist the graph? (toJSON/fromJSON)
- How to handle large graphs? (batch operations, viewport culling)

**Step 1: Write all 3 pages**

**Step 2: Verify** — dev server

**Step 3: Commit**

```
docs(flow): add contributing, changelog, and FAQ pages
```

---

### Task 7: Final build verification

**Step 1: Build the documentation site**

Run: `pnpm --filter @quantum-studios/flow-docs build`
Expected: BUILD SUCCESS, output in `packages/flow-docs/.vitepress/dist/`

**Step 2: Preview the built site**

Run: `pnpm --filter @quantum-studios/flow-docs preview`
Expected: Static site serves correctly, all links work

**Step 3: Fix any broken links or build warnings**

**Step 4: Commit any fixes**

```
docs(flow): fix build warnings and broken links
```

---
