# VitePress Documentation Site Design

**Goal:** Create a full documentation site for `@quantum-studios/flow` using VitePress, with guides, API reference, examples, and a playground.

---

## Structure

New package `packages/flow-docs/` in the monorepo.

```
packages/flow-docs/
  .vitepress/
    config.ts                # VitePress config (nav, sidebar, theme)
  index.md                   # Landing page hero
  getting-started.md         # Install, setup, first example
  guide/
    concepts.md              # Architecture (store, events, hooks)
    flow-canvas.md           # FlowCanvas component + theming
    react-hooks.md           # useFlowEditor, useGraphStore, useHistory
    clipboard.md             # Copy/cut/paste
    context-provider.md      # FlowProvider + useFlowContext
    advanced.md              # Custom hooks, validation, node registry
  api/
    hooks.md                 # Detailed API ref for each hook
    types.md                 # FlowNode, FlowConnection, FlowGraph, etc.
    components.md            # FlowCanvas props + FlowProvider props
    model.md                 # GraphStore, EventBus, Validator, HistoryManager
  examples/
    minimal.md               # Minimal example
    full-editor.md           # Full editor with toolbar undo/redo/save
    playground.md            # Interactive code (StackBlitz embed)
  contributing.md
  changelog.md
  faq.md
  package.json
```

## Navigation

**Navbar:** Getting Started | Guide | API | Examples

**Sidebar per section:**
- Guide: concepts, flow-canvas, react-hooks, clipboard, context-provider, advanced
- API: hooks, types, components, model
- Examples: minimal, full-editor, playground

## Theme

- Dark mode enabled by default
- VitePress default theme with custom colors matching Quantum Studios branding
- Logo in navbar
