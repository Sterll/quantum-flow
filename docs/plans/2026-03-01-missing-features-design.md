# Missing Features Design

**Goal:** Extend the React API with proxy methods, clipboard support, and a Context Provider to close the gaps between GraphStore capabilities and the public hook API.

---

## 1. FlowEditorAPI Extended Proxies

Add stable `useCallback` wrappers to `FlowEditorAPI` for GraphStore methods not yet proxied:

```typescript
// Mutations
moveNode(nodeId: string, position: FlowNodePosition): void
updateNodeData(nodeId: string, data: Record<string, unknown>): void
batch(fn: () => void): void
clear(): void

// Queries (direct store access)
getNode(id: string): FlowNode | undefined
getNodes(): FlowNode[]
getConnections(): FlowConnection[]
getConnectionsForNode(nodeId: string): FlowConnection[]
```

No new files — extends `useFlowEditor.ts`.

---

## 2. useClipboard

New hook at `packages/flow/src/react/useClipboard.ts`.

```typescript
interface UseClipboardAPI {
  copy(nodeIds: Set<string> | string[]): void
  cut(nodeIds: Set<string> | string[]): void
  paste(offset?: { x: number; y: number }): FlowNode[]
  canPaste: boolean
}
```

**Behavior:**
- `copy` — snapshots selected nodes + internal connections (between selected nodes only) into an in-memory buffer (useRef)
- `cut` — copy then removeNode for each selected node (via store.batch)
- `paste` — duplicates nodes with new UUIDs, remaps internal connections to new IDs, applies position offset (+20,+20 default). Uses store.batch(). Returns created nodes.
- `canPaste` — React state boolean, true when buffer is non-empty

In-memory buffer only (no system clipboard).

Integrated into `FlowEditorAPI` as `copy`, `cut`, `paste`, `canPaste`.

---

## 3. FlowProvider + useFlowContext

New file `packages/flow/src/react/FlowProvider.tsx`.

```typescript
interface FlowProviderProps extends UseFlowEditorOptions {
  children: React.ReactNode
}

function FlowProvider({ children, ...options }: FlowProviderProps): JSX.Element
function useFlowContext(): FlowEditorAPI  // throws if used outside provider
```

**Behavior:**
- `FlowProvider` calls `useFlowEditor(options)` internally and places the result in React Context
- `useFlowContext()` returns the full `FlowEditorAPI` (including clipboard, proxies, registry)
- Throws `"useFlowContext must be used within a FlowProvider"` if used outside

---

## File Structure

```
packages/flow/src/react/
  useGraphStore.ts       (existing)
  useHistory.ts          (existing)
  useFlowEditor.ts       (modified — extended proxies + clipboard integration)
  useClipboard.ts        (new)
  FlowProvider.tsx        (new)
  index.ts               (modified — add new exports)
```
