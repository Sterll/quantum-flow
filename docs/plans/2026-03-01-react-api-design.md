# React API Design

**Goal:** Provide ergonomic React hooks for `@quantum-studios/flow` — a convenience `useFlowEditor` for the common case, plus individual hooks (`useGraphStore`, `useHistory`) for advanced composition.

---

## Architecture

```
Consumer code
  └─ useFlowEditor(options)           // All-in-one (recommended)
       ├─ useGraphStore(options)      // Creates stable GraphStore
       ├─ useHistory(store, options)  // Wraps HistoryManager with reactive state
       └─ NodeRegistry (optional)     // Pre-populated from options.registry

Consumer can also use individual hooks directly for advanced cases.
```

---

## useGraphStore

```typescript
interface UseGraphStoreOptions {
  initialGraph?: FlowGraph
  validator?: Validator
}

function useGraphStore(options?: UseGraphStoreOptions): GraphStore
```

**Behavior:**
- Creates `GraphStore` once via `useMemo` with optional validator
- If `initialGraph` provided, calls `store.importGraph(initialGraph)` at creation
- Returns the same stable instance across renders

---

## useHistory

```typescript
interface UseHistoryOptions {
  maxSize?: number
}

interface UseHistoryAPI {
  undo(): boolean
  redo(): boolean
  canUndo: boolean
  canRedo: boolean
  history: HistoryManager
}

function useHistory(store: GraphStore, options?: UseHistoryOptions): UseHistoryAPI
```

**Behavior:**
- Creates `HistoryManager` once via `useMemo`
- `canUndo` / `canRedo` are React state (trigger re-renders when they change)
- Subscribes to store mutation events to update `canUndo`/`canRedo` automatically
- Exposes the raw `HistoryManager` instance for advanced usage (getUndoStack, etc.)

---

## useFlowEditor

```typescript
interface UseFlowEditorOptions {
  initialGraph?: FlowGraph
  validator?: Validator
  history?: boolean | { maxSize?: number }  // default: true
  registry?: NodeDefinitionWithFactory[]
}

interface FlowEditorAPI {
  // Core
  store: GraphStore

  // History (no-op if history: false)
  undo(): boolean
  redo(): boolean
  canUndo: boolean
  canRedo: boolean

  // Convenience proxies
  addNode(node: FlowNode): void
  removeNode(nodeId: string): void
  addConnection(connection: FlowConnection): void
  removeConnection(connectionId: string): void

  // Serialization
  toJSON(): FlowGraph
  fromJSON(graph: FlowGraph): void

  // Registry (null if no registry provided)
  registry: NodeRegistry | null
}

function useFlowEditor(options?: UseFlowEditorOptions): FlowEditorAPI
```

**Behavior:**
- Composes `useGraphStore` + `useHistory` (if history enabled) + `NodeRegistry` (if registry provided)
- Convenience methods (`addNode`, `removeNode`, etc.) are stable callbacks proxying to store
- `toJSON()` = `store.getState()`, `fromJSON()` = `store.importGraph()`
- `canUndo`/`canRedo` are reactive (re-render when they change)
- If `history: false`, `undo()`/`redo()` silently return `false`, `canUndo`/`canRedo` = `false`

---

## Usage Examples

### Minimal
```tsx
const editor = useFlowEditor()
return <FlowCanvas store={editor.store} />
```

### Full
```tsx
const editor = useFlowEditor({
  initialGraph: savedGraph,
  validator: myValidator,
  history: { maxSize: 100 },
  registry: [branchNode, eventNode],
})

return (
  <>
    <FlowCanvas store={editor.store} onSelectionChange={setSelection} />
    <button disabled={!editor.canUndo} onClick={editor.undo}>Undo</button>
    <button onClick={() => save(editor.toJSON())}>Save</button>
  </>
)
```

### Advanced (individual hooks)
```tsx
const store = useGraphStore({ validator: customValidator })
const { undo, redo, canUndo } = useHistory(store, { maxSize: 200 })
return <FlowCanvas store={store} />
```

---

## File Structure

```
packages/flow/src/
  react/
    useGraphStore.ts
    useHistory.ts
    useFlowEditor.ts
    index.ts           // barrel export
```

Exported via `packages/flow/src/index.ts` → `export * from './react'`
