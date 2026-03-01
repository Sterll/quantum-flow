# Changelog

All notable changes to `@quantum-studios/flow` are documented on this page.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

---

## v0.1.0 -- Initial Release

The first public release of `@quantum-studios/flow`, a headless, Canvas 2D node editor for React.

### Model Layer

The framework-agnostic foundation that can be used with or without React.

- **GraphStore** -- Single source of truth for the graph state. Holds all nodes and connections, exposes mutation methods (`addNode`, `removeNode`, `moveNode`, `updateNodeData`, `addConnection`, `removeConnection`, `clear`, `importGraph`), query helpers (`getNode`, `getConnectionsForNode`, `getConnectionsForPin`, `hasConnection`), batch operations (`batch()`), and serialization (`getState`, `clone`).
- **EventBus** -- Typed publish/subscribe system. Emits events for every graph mutation (`node:added`, `node:removed`, `node:moved`, `node:dataChanged`, `connection:added`, `connection:removed`, `graph:cleared`, `graph:imported`, `batch:start`, `batch:end`). Supports `on`, `off`, `once`, and `emit`.
- **Validator** -- Composable validation pipeline that runs before every mutation. Ships with 6 built-in rules:
  - `noSelfConnection()` -- prevents connecting a node to itself
  - `noDuplicateConnection()` -- prevents creating the same connection twice
  - `typeCompatibility(overrides?)` -- enforces pin type matching with optional custom compatibility maps
  - `noDuplicateNodeId()` -- prevents adding a node with an existing ID
  - `noCycles()` -- prevents creating cycles in the graph
  - `maxConnectionsPerPin(max)` -- limits connections per pin

  Custom rules can be added via the `ValidationRule` interface.
- **HistoryManager** -- Undo/redo engine that auto-subscribes to `GraphStore` events and captures snapshots. Supports configurable `maxSize`, auto-generated labels, and batch-aware history (batch operations produce a single undo entry).

### Define Layer

Node blueprint and registry system for reusable node types.

- **defineNode** -- Declares a node blueprint (`NodeDefinition`) and returns a `NodeDefinitionWithFactory` enriched with a `createInstance(position, overrides?)` method. Generates UUIDs for each instance, validates pin ID uniqueness at definition time, and supports `category`, `color`, `icon`, and `defaultData`.
- **NodeRegistry** -- Catalog of registered node definitions. Provides `register`, `registerMany`, `unregister`, `has`, `get`, `getAll`, `getByNamespace`, and `getCategories` for building node palettes and plugin systems.

### Interaction Hooks

Low-level React hooks for canvas interaction, designed to be composed together.

- **useViewport** -- Pan and zoom management. Tracks offset, scale, and provides `pan()`, `zoomTo()`, `fitToContent()`, and coordinate conversion between screen and graph space.
- **useNodeDrag** -- Node drag-and-drop with position snapping support.
- **useConnection** -- Connection creation by dragging between pins. Handles draft wire rendering and validation on drop.
- **useSelection** -- Multi-select with click, Shift+click, and marquee (rubber-band) selection.
- **useHotkeys** -- Keyboard shortcut management for common editor actions (delete, undo, redo, select all, copy, paste).
- **useCanvasInteraction** -- Orchestrator hook that composes viewport, drag, connection, and selection hooks into a unified pointer event handler.

### React API

High-level hooks and context for building editor UIs.

- **useFlowEditor** -- All-in-one hook that composes `GraphStore`, `Validator`, `HistoryManager`, and `NodeRegistry` into a single `FlowEditorAPI` object. Accepts options for `validator`, `history`, `registry`, and `initialGraph`.
- **useGraphStore** -- Subscribe to `GraphStore` state changes with automatic React re-renders.
- **useHistory** -- React-friendly wrapper around `HistoryManager` with reactive `canUndo` / `canRedo` state.
- **useClipboard** -- Copy, cut, and paste operations for selected nodes and their connections.
- **FlowProvider** -- React context provider that makes the `FlowEditorAPI` available to the component tree via `useFlowContext`.

### Components

- **FlowCanvas** -- Canvas 2D renderer that reads from `GraphStore` on every animation frame. Supports pan, zoom, node rendering, connection wires, selection highlights, and grid background.

### Testing

- **140 tests** across **17 test files** covering every layer of the library.
- Tests use **Vitest** with `jsdom` environment and `@testing-library/react` for hook and component tests.
- Test files: `types`, `EventBus`, `Validator`, `GraphStore`, `HistoryManager`, `defineNode`, `hitTest`, `useViewport`, `useNodeDrag`, `useSelection`, `useConnection`, `useHotkeys`, `useGraphStore`, `useHistory`, `useClipboard`, `useFlowEditor`, `FlowProvider`.

### Build

- **tsup** produces three outputs: ESM (`index.mjs`), CJS (`index.js`), and TypeScript declarations (`index.d.ts`).
- React 18+ is a peer dependency (not bundled).
- Zero runtime dependencies beyond React.
