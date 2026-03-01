# Clipboard

`@quantum-studios/flow` provides a clipboard system for copying, cutting, and pasting nodes. It works with node selections and intelligently handles connections: internal connections between copied nodes are preserved, while connections to nodes outside the selection are dropped.

## Quick Start

If you use `useFlowEditor`, clipboard is built in:

```tsx
import { useFlowEditor, FlowCanvas } from '@quantum-studios/flow'

function Editor() {
  const editor = useFlowEditor()

  return (
    <div>
      <button
        onClick={() => editor.copy(selectedIds)}
        disabled={selectedIds.size === 0}
      >
        Copy
      </button>
      <button
        onClick={() => editor.cut(selectedIds)}
        disabled={selectedIds.size === 0}
      >
        Cut
      </button>
      <button
        onClick={() => editor.paste()}
        disabled={!editor.canPaste}
      >
        Paste
      </button>
      <FlowCanvas store={editor.store} />
    </div>
  )
}
```

## useClipboard Hook

For advanced use cases where you compose hooks manually, `useClipboard` is available as a standalone hook.

### Signature

```typescript
function useClipboard(store: GraphStore): UseClipboardAPI
```

### Return Value

```typescript
interface UseClipboardAPI {
  copy(nodeIds: Set<string> | string[]): void
  cut(nodeIds: Set<string> | string[]): void
  paste(offset?: { x: number; y: number }): FlowNode[]
  canPaste: boolean
}
```

### Usage

```tsx
import { useGraphStore, useClipboard, FlowCanvas } from '@quantum-studios/flow'

function Editor() {
  const store = useGraphStore()
  const { copy, cut, paste, canPaste } = useClipboard(store)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  return (
    <div>
      <button onClick={() => copy(selectedIds)}>Copy</button>
      <button onClick={() => cut(selectedIds)}>Cut</button>
      <button onClick={() => paste()} disabled={!canPaste}>Paste</button>
      <FlowCanvas
        store={store}
        onSelectionChange={setSelectedIds}
      />
    </div>
  )
}
```

## API Reference

### copy(nodeIds)

Copies the specified nodes and their internal connections to an in-memory buffer. Does not modify the graph.

```typescript
copy(nodeIds: Set<string> | string[]): void
```

- Accepts either a `Set<string>` or a `string[]` of node IDs
- Only connections where **both** `fromNodeId` and `toNodeId` are in the selection are copied
- If no nodes match the given IDs, the operation is a no-op

```tsx
// Copy from a Set (e.g., from onSelectionChange)
copy(selectedIds)

// Copy from an array
copy(['node-1', 'node-2'])
```

### cut(nodeIds)

Copies the specified nodes (same as `copy`), then removes them from the graph in a single batch operation.

```typescript
cut(nodeIds: Set<string> | string[]): void
```

- The removal is wrapped in `store.batch()`, so it counts as one undo step
- Connected connections to removed nodes are automatically cleaned up by `GraphStore.removeNode()`

```tsx
// Cut selected nodes
cut(selectedIds)

// One undo() call restores all cut nodes
editor.undo()
```

### paste(offset?)

Pastes the buffered nodes into the graph with new IDs and remapped connections.

```typescript
paste(offset?: { x: number; y: number }): FlowNode[]
```

- Returns an array of the newly created `FlowNode` objects
- Returns an empty array if the buffer is empty
- Each pasted node gets a fresh UUID
- Internal connections are remapped to the new node IDs
- The paste is wrapped in `store.batch()`, so it counts as one undo step

```tsx
// Paste with default offset (20, 20)
const newNodes = paste()

// Paste with custom offset
const newNodes = paste({ x: 50, y: 50 })

// Paste at the same position (overlay)
const newNodes = paste({ x: 0, y: 0 })
```

### canPaste

A reactive boolean that indicates whether the clipboard buffer has content.

```typescript
canPaste: boolean
```

- `false` initially (no copy has been performed)
- Becomes `true` after a successful `copy()` or `cut()`
- Stays `true` until the component unmounts (the buffer is never cleared automatically)

```tsx
<button disabled={!canPaste}>Paste</button>
```

## How It Works

### Copy Flow

1. The selected node IDs are resolved against the current graph
2. All connections where both endpoints are in the selection are collected
3. Both lists are stored in an internal ref (not React state, to avoid unnecessary re-renders)
4. `canPaste` is set to `true`

### Paste Flow

1. For each buffered node, a new UUID is generated
2. An ID mapping is created: `oldId -> newId`
3. Nodes are cloned with new IDs and offset positions
4. Connections are cloned with new IDs and remapped `fromNodeId` / `toNodeId`
5. Everything is added to the store in a single `batch()` call

### Connection Handling

This is the key insight: **only internal connections are preserved**.

```
Before copy (nodes A, B, C selected; D not selected):

  [A] ---conn1---> [B] ---conn2---> [C] ---conn3---> [D]

After paste:

  [A'] ---conn1'---> [B'] ---conn2'---> [C']
  (conn3 is dropped because D was not in the selection)
```

::: info
This behavior ensures that pasted subgraphs are self-contained and do not create dangling references to nodes that may or may not exist in the target context.
:::

## Integration with Selection

The most common pattern is to wire the clipboard to the canvas selection:

```tsx
function Editor() {
  const editor = useFlowEditor()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'c') {
      editor.copy(selectedIds)
    } else if (e.ctrlKey && e.key === 'x') {
      editor.cut(selectedIds)
    } else if (e.ctrlKey && e.key === 'v') {
      const newNodes = editor.paste()
      // Optionally select the pasted nodes
      setSelectedIds(new Set(newNodes.map(n => n.id)))
    }
  }

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0}>
      <FlowCanvas
        store={editor.store}
        onSelectionChange={setSelectedIds}
      />
    </div>
  )
}
```

## Paste Offset

By default, pasted nodes are offset by `{ x: 20, y: 20 }` from their original position. This prevents them from overlapping the original nodes and makes it visually clear that a paste occurred.

You can customize the offset:

```tsx
// Stack pastes vertically
paste({ x: 0, y: 100 })

// Paste far to the right
paste({ x: 300, y: 0 })

// Paste exactly on top (useful for cross-graph paste)
paste({ x: 0, y: 0 })
```

::: tip
If you paste multiple times without changing the offset, each paste stacks the nodes at the same offset from the **original** copied position (not from the last paste). This is because the buffer stores the original node positions.
:::

## Multiple Pastes

You can paste the same buffer as many times as you want. Each paste generates fresh UUIDs:

```tsx
// Copy once
editor.copy(selectedIds)

// Paste three times at different positions
editor.paste({ x: 50, y: 0 })    // First copy
editor.paste({ x: 100, y: 0 })   // Second copy
editor.paste({ x: 150, y: 0 })   // Third copy
```

Each paste is an independent batch operation, so each can be undone individually.
