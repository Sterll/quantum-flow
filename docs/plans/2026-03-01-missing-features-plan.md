# Missing Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the React API with proxy methods, clipboard support, and a Context Provider.

**Architecture:** Task 1 adds missing GraphStore proxies to FlowEditorAPI. Task 2 creates a standalone `useClipboard` hook for copy/cut/paste. Task 3 integrates clipboard into FlowEditorAPI. Task 4 adds FlowProvider + useFlowContext. Task 5 updates barrel exports.

**Tech Stack:** TypeScript 5, React 18, Vitest (jsdom), pnpm monorepo, tsup bundler

---

### Task 1: Extend FlowEditorAPI with missing proxies

**Files:**
- Modify: `packages/flow/src/react/useFlowEditor.ts`
- Modify: `packages/flow/tests/useFlowEditor.test.ts`

**Step 1: Write the failing tests**

Append these tests to the existing `describe('useFlowEditor', ...)` block in `packages/flow/tests/useFlowEditor.test.ts`:

```typescript
  it('moveNode proxies to store', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    act(() => {
      result.current.moveNode('n1', { x: 100, y: 200 })
    })
    const node = result.current.getNode('n1')
    expect(node?.position).toEqual({ x: 100, y: 200 })
  })

  it('updateNodeData merges data', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode({ ...makeNode('n1'), data: { a: 1 } })
    })
    act(() => {
      result.current.updateNodeData('n1', { b: 2 })
    })
    const node = result.current.getNode('n1')
    expect(node?.data).toEqual({ a: 1, b: 2 })
  })

  it('batch groups operations into single undo', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.batch(() => {
        result.current.store.addNode(makeNode('n1'))
        result.current.store.addNode(makeNode('n2'))
      })
    })
    expect(result.current.getNodes()).toHaveLength(2)
    act(() => {
      result.current.undo()
    })
    expect(result.current.getNodes()).toHaveLength(0)
  })

  it('clear removes all nodes and connections', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
      result.current.addNode(makeNode('n2'))
    })
    act(() => {
      result.current.clear()
    })
    expect(result.current.getNodes()).toHaveLength(0)
    expect(result.current.getConnections()).toHaveLength(0)
  })

  it('getNode returns a node by id', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    expect(result.current.getNode('n1')).toBeDefined()
    expect(result.current.getNode('n1')?.label).toBe('n1')
    expect(result.current.getNode('nonexistent')).toBeUndefined()
  })

  it('getNodes returns all nodes', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
      result.current.addNode(makeNode('n2'))
    })
    expect(result.current.getNodes()).toHaveLength(2)
  })

  it('getConnections returns all connections', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode({
        ...makeNode('n1'),
        outputs: [{ id: 'out', type: 'exec', label: '' }],
      })
      result.current.addNode({
        ...makeNode('n2'),
        inputs: [{ id: 'in', type: 'exec', label: '' }],
      })
      result.current.addConnection(makeConnection('c1', 'n1', 'out', 'n2', 'in'))
    })
    expect(result.current.getConnections()).toHaveLength(1)
  })

  it('getConnectionsForNode filters by node', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode({
        ...makeNode('n1'),
        outputs: [{ id: 'out', type: 'exec', label: '' }],
      })
      result.current.addNode({
        ...makeNode('n2'),
        inputs: [{ id: 'in', type: 'exec', label: '' }],
      })
      result.current.addNode(makeNode('n3'))
      result.current.addConnection(makeConnection('c1', 'n1', 'out', 'n2', 'in'))
    })
    expect(result.current.getConnectionsForNode('n1')).toHaveLength(1)
    expect(result.current.getConnectionsForNode('n3')).toHaveLength(0)
  })
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useFlowEditor.test.ts`
Expected: FAIL — `moveNode`, `updateNodeData`, `batch`, `clear`, `getNode`, `getNodes`, `getConnections`, `getConnectionsForNode` are not properties of result.current

**Step 3: Write the implementation**

Modify `packages/flow/src/react/useFlowEditor.ts`:

Add to `FlowEditorAPI` interface (after the existing members, before `registry`):

```typescript
  moveNode(nodeId: string, position: FlowNodePosition): void
  updateNodeData(nodeId: string, data: Record<string, unknown>): void
  batch(fn: () => void): void
  clear(): void

  getNode(id: string): FlowNode | undefined
  getNodes(): FlowNode[]
  getConnections(): FlowConnection[]
  getConnectionsForNode(nodeId: string): FlowConnection[]
```

Add `FlowNodePosition` to the type import at the top:

```typescript
import type { FlowNode, FlowConnection, FlowGraph, FlowNodePosition } from '../types'
```

Add `useCallback` wrappers after the existing ones (after `fromJSON`):

```typescript
  const moveNode = useCallback((nodeId: string, position: FlowNodePosition) => store.moveNode(nodeId, position), [store])
  const updateNodeData = useCallback((nodeId: string, data: Record<string, unknown>) => store.updateNodeData(nodeId, data), [store])
  const batch = useCallback((fn: () => void) => store.batch(fn), [store])
  const clear = useCallback(() => store.clear(), [store])
  const getNode = useCallback((id: string) => store.getNode(id), [store])
  const getNodes = useCallback(() => store.getNodes(), [store])
  const getConnections = useCallback(() => store.getConnections(), [store])
  const getConnectionsForNode = useCallback((nodeId: string) => store.getConnectionsForNode(nodeId), [store])
```

Add them to the return object (before `registry`):

```typescript
    moveNode,
    updateNodeData,
    batch,
    clear,
    getNode,
    getNodes,
    getConnections,
    getConnectionsForNode,
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useFlowEditor.test.ts`
Expected: 20 tests PASS (12 existing + 8 new)

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): add moveNode, updateNodeData, batch, clear, and query proxies to FlowEditorAPI
```

---

### Task 2: useClipboard hook — tests + implementation

**Files:**
- Create: `packages/flow/src/react/useClipboard.ts`
- Create: `packages/flow/tests/useClipboard.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/useClipboard.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipboard } from '../src/react/useClipboard'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowNode, FlowConnection } from '../src/types'

const makeNode = (id: string, x = 0, y = 0): FlowNode => ({
  id, type: 'test/node', label: id,
  position: { x, y }, inputs: [], outputs: [], data: {},
})

const makeNodeWithPins = (id: string, x = 0, y = 0): FlowNode => ({
  id, type: 'test/node', label: id,
  position: { x, y },
  inputs: [{ id: 'in', type: 'exec', label: '' }],
  outputs: [{ id: 'out', type: 'exec', label: '' }],
  data: {},
})

const makeConnection = (id: string, from: string, to: string): FlowConnection => ({
  id, fromNodeId: from, fromPinId: 'out', toNodeId: to, toPinId: 'in',
})

describe('useClipboard', () => {
  it('starts with canPaste=false', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useClipboard(store))
    expect(result.current.canPaste).toBe(false)
  })

  it('copy fills buffer and sets canPaste=true', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const { result } = renderHook(() => useClipboard(store))
    act(() => {
      result.current.copy(new Set(['n1']))
    })
    expect(result.current.canPaste).toBe(true)
  })

  it('copy ignores unknown node ids', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const { result } = renderHook(() => useClipboard(store))
    act(() => {
      result.current.copy(['n1', 'nonexistent'])
    })
    expect(result.current.canPaste).toBe(true)
  })

  it('paste duplicates nodes with new IDs and offset', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 200))
    const { result } = renderHook(() => useClipboard(store))
    act(() => {
      result.current.copy(['n1'])
    })
    let pasted: FlowNode[] = []
    act(() => {
      pasted = result.current.paste()
    })
    expect(pasted).toHaveLength(1)
    expect(pasted[0].id).not.toBe('n1')
    expect(pasted[0].position).toEqual({ x: 120, y: 220 })
    expect(pasted[0].label).toBe('n1')
    expect(store.getNodes()).toHaveLength(2)
  })

  it('paste applies custom offset', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 50, 50))
    const { result } = renderHook(() => useClipboard(store))
    act(() => {
      result.current.copy(['n1'])
    })
    let pasted: FlowNode[] = []
    act(() => {
      pasted = result.current.paste({ x: 100, y: 0 })
    })
    expect(pasted[0].position).toEqual({ x: 150, y: 50 })
  })

  it('paste copies internal connections with remapped IDs', () => {
    const store = new GraphStore()
    store.addNode(makeNodeWithPins('n1'))
    store.addNode(makeNodeWithPins('n2'))
    store.addConnection(makeConnection('c1', 'n1', 'n2'))
    const { result } = renderHook(() => useClipboard(store))

    act(() => {
      result.current.copy(['n1', 'n2'])
    })
    let pasted: FlowNode[] = []
    act(() => {
      pasted = result.current.paste()
    })
    expect(pasted).toHaveLength(2)
    // Should have original 2 nodes + 2 pasted = 4 nodes
    expect(store.getNodes()).toHaveLength(4)
    // Should have original 1 connection + 1 remapped = 2
    expect(store.getConnections()).toHaveLength(2)
    // The new connection should reference the new node IDs
    const newConn = store.getConnections().find(c => c.id !== 'c1')!
    expect(newConn.fromNodeId).not.toBe('n1')
    expect(newConn.toNodeId).not.toBe('n2')
    expect(pasted.map(n => n.id)).toContain(newConn.fromNodeId)
    expect(pasted.map(n => n.id)).toContain(newConn.toNodeId)
  })

  it('paste does not copy external connections', () => {
    const store = new GraphStore()
    store.addNode(makeNodeWithPins('n1'))
    store.addNode(makeNodeWithPins('n2'))
    store.addNode(makeNodeWithPins('n3'))
    store.addConnection(makeConnection('c1', 'n1', 'n2'))
    store.addConnection(makeConnection('c2', 'n2', 'n3'))
    const { result } = renderHook(() => useClipboard(store))

    // Only copy n1 and n2, not n3
    act(() => {
      result.current.copy(['n1', 'n2'])
    })
    act(() => {
      result.current.paste()
    })
    // Original: 3 nodes + 2 connections. After paste: 5 nodes + 3 connections (only c1 remapped)
    expect(store.getNodes()).toHaveLength(5)
    expect(store.getConnections()).toHaveLength(3)
  })

  it('cut removes original nodes and fills buffer', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    const { result } = renderHook(() => useClipboard(store))

    act(() => {
      result.current.cut(new Set(['n1']))
    })
    expect(store.getNodes()).toHaveLength(1)
    expect(store.getNodes()[0].id).toBe('n2')
    expect(result.current.canPaste).toBe(true)
  })

  it('paste can be called multiple times', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const { result } = renderHook(() => useClipboard(store))

    act(() => {
      result.current.copy(['n1'])
    })
    act(() => {
      result.current.paste()
    })
    act(() => {
      result.current.paste()
    })
    expect(store.getNodes()).toHaveLength(3)
  })

  it('paste returns empty array when buffer is empty', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useClipboard(store))
    let pasted: FlowNode[] = []
    act(() => {
      pasted = result.current.paste()
    })
    expect(pasted).toEqual([])
  })

  it('accepts string array for nodeIds', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const { result } = renderHook(() => useClipboard(store))
    act(() => {
      result.current.copy(['n1'])
    })
    expect(result.current.canPaste).toBe(true)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useClipboard.test.ts`
Expected: FAIL — cannot find module `../src/react/useClipboard`

**Step 3: Write the implementation**

```typescript
// packages/flow/src/react/useClipboard.ts
import { useCallback, useRef, useState } from 'react'
import type { GraphStore } from '../model/GraphStore'
import type { FlowNode, FlowConnection } from '../types'

interface ClipboardBuffer {
  nodes: FlowNode[]
  connections: FlowConnection[]
}

export interface UseClipboardAPI {
  copy(nodeIds: Set<string> | string[]): void
  cut(nodeIds: Set<string> | string[]): void
  paste(offset?: { x: number; y: number }): FlowNode[]
  canPaste: boolean
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useClipboard(store: GraphStore): UseClipboardAPI {
  const bufferRef = useRef<ClipboardBuffer | null>(null)
  const [canPaste, setCanPaste] = useState(false)

  const copy = useCallback((nodeIds: Set<string> | string[]) => {
    const idSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds)

    const nodes = store.getNodes().filter(n => idSet.has(n.id))
    if (nodes.length === 0) return

    const connections = store.getConnections().filter(
      c => idSet.has(c.fromNodeId) && idSet.has(c.toNodeId),
    )

    bufferRef.current = { nodes, connections }
    setCanPaste(true)
  }, [store])

  const cut = useCallback((nodeIds: Set<string> | string[]) => {
    copy(nodeIds)
    const idSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds)
    store.batch(() => {
      for (const id of idSet) {
        store.removeNode(id)
      }
    })
  }, [store, copy])

  const paste = useCallback((offset?: { x: number; y: number }): FlowNode[] => {
    if (!bufferRef.current) return []

    const dx = offset?.x ?? 20
    const dy = offset?.y ?? 20
    const idMap = new Map<string, string>()

    const newNodes: FlowNode[] = bufferRef.current.nodes.map(node => {
      const newId = generateId()
      idMap.set(node.id, newId)
      return {
        ...node,
        id: newId,
        position: { x: node.position.x + dx, y: node.position.y + dy },
      }
    })

    const newConnections: FlowConnection[] = bufferRef.current.connections.map(conn => ({
      ...conn,
      id: generateId(),
      fromNodeId: idMap.get(conn.fromNodeId)!,
      toNodeId: idMap.get(conn.toNodeId)!,
    }))

    store.batch(() => {
      for (const node of newNodes) store.addNode(node)
      for (const conn of newConnections) store.addConnection(conn)
    })

    return newNodes
  }, [store])

  return { copy, cut, paste, canPaste }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useClipboard.test.ts`
Expected: 11 tests PASS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): add useClipboard hook with copy, cut, paste support
```

---

### Task 3: Integrate clipboard into FlowEditorAPI

**Files:**
- Modify: `packages/flow/src/react/useFlowEditor.ts`
- Modify: `packages/flow/tests/useFlowEditor.test.ts`

**Step 1: Write the failing tests**

Append these tests to the existing `describe('useFlowEditor', ...)` block:

```typescript
  it('copy/paste duplicates selected nodes', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    act(() => {
      result.current.copy(['n1'])
    })
    expect(result.current.canPaste).toBe(true)
    let pasted: FlowNode[] = []
    act(() => {
      pasted = result.current.paste()
    })
    expect(pasted).toHaveLength(1)
    expect(result.current.getNodes()).toHaveLength(2)
  })

  it('cut removes nodes and paste restores them', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    act(() => {
      result.current.cut(['n1'])
    })
    expect(result.current.getNodes()).toHaveLength(0)
    expect(result.current.canPaste).toBe(true)
    act(() => {
      result.current.paste()
    })
    expect(result.current.getNodes()).toHaveLength(1)
  })

  it('canPaste is false initially', () => {
    const { result } = renderHook(() => useFlowEditor())
    expect(result.current.canPaste).toBe(false)
  })
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useFlowEditor.test.ts`
Expected: FAIL — `copy`, `cut`, `paste`, `canPaste` are not properties of result.current

**Step 3: Write the implementation**

Modify `packages/flow/src/react/useFlowEditor.ts`:

Add import at top:
```typescript
import { useClipboard } from './useClipboard'
```

Add to `FlowEditorAPI` interface:
```typescript
  copy(nodeIds: Set<string> | string[]): void
  cut(nodeIds: Set<string> | string[]): void
  paste(offset?: { x: number; y: number }): FlowNode[]
  canPaste: boolean
```

Inside `useFlowEditor` function, after the existing `useCallback` wrappers:
```typescript
  const clipboard = useClipboard(store)
```

Add to the return object:
```typescript
    copy: clipboard.copy,
    cut: clipboard.cut,
    paste: clipboard.paste,
    canPaste: clipboard.canPaste,
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useFlowEditor.test.ts`
Expected: 23 tests PASS (20 from Task 1 + 3 new)

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): integrate clipboard (copy/cut/paste) into FlowEditorAPI
```

---

### Task 4: FlowProvider + useFlowContext

**Files:**
- Create: `packages/flow/src/react/FlowProvider.tsx`
- Create: `packages/flow/tests/FlowProvider.test.tsx`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/FlowProvider.test.tsx
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { FlowProvider, useFlowContext } from '../src/react/FlowProvider'
import type { FlowGraph } from '../src/types'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FlowProvider>{children}</FlowProvider>
)

describe('FlowProvider + useFlowContext', () => {
  it('provides FlowEditorAPI via context', () => {
    const { result } = renderHook(() => useFlowContext(), { wrapper })
    expect(result.current.store).toBeDefined()
    expect(result.current.store.getNodes()).toEqual([])
  })

  it('throws when useFlowContext is used outside FlowProvider', () => {
    expect(() => {
      renderHook(() => useFlowContext())
    }).toThrow('useFlowContext must be used within a FlowProvider')
  })

  it('passes options to useFlowEditor', () => {
    const graph: FlowGraph = {
      nodes: [{
        id: 'n1', type: 'test/node', label: 'Test',
        position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
      }],
      connections: [],
    }
    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <FlowProvider initialGraph={graph}>{children}</FlowProvider>
    )
    const { result } = renderHook(() => useFlowContext(), { wrapper: customWrapper })
    expect(result.current.getNodes()).toHaveLength(1)
  })

  it('exposes undo/redo from context', () => {
    const { result } = renderHook(() => useFlowContext(), { wrapper })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    expect(typeof result.current.undo).toBe('function')
    expect(typeof result.current.redo).toBe('function')
  })

  it('exposes clipboard from context', () => {
    const { result } = renderHook(() => useFlowContext(), { wrapper })
    expect(result.current.canPaste).toBe(false)
    expect(typeof result.current.copy).toBe('function')
    expect(typeof result.current.cut).toBe('function')
    expect(typeof result.current.paste).toBe('function')
  })

  it('returns same reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useFlowContext(), { wrapper })
    const first = result.current.store
    rerender()
    expect(result.current.store).toBe(first)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/FlowProvider.test.tsx`
Expected: FAIL — cannot find module `../src/react/FlowProvider`

**Step 3: Write the implementation**

```typescript
// packages/flow/src/react/FlowProvider.tsx
import { createContext, useContext } from 'react'
import { useFlowEditor, type UseFlowEditorOptions, type FlowEditorAPI } from './useFlowEditor'

const FlowContext = createContext<FlowEditorAPI | null>(null)

export interface FlowProviderProps extends UseFlowEditorOptions {
  children: React.ReactNode
}

export function FlowProvider({ children, ...options }: FlowProviderProps): JSX.Element {
  const editor = useFlowEditor(options)
  return <FlowContext.Provider value={editor}>{children}</FlowContext.Provider>
}

export function useFlowContext(): FlowEditorAPI {
  const ctx = useContext(FlowContext)
  if (!ctx) {
    throw new Error('useFlowContext must be used within a FlowProvider')
  }
  return ctx
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/FlowProvider.test.tsx`
Expected: 6 tests PASS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): add FlowProvider and useFlowContext for React context support
```

---

### Task 5: Update barrel exports

**Files:**
- Modify: `packages/flow/src/react/index.ts`

**Step 1: Update the barrel export**

Replace `packages/flow/src/react/index.ts` with:

```typescript
export { useGraphStore, type UseGraphStoreOptions } from './useGraphStore'
export { useHistory, type UseHistoryOptions, type UseHistoryAPI } from './useHistory'
export { useFlowEditor, type UseFlowEditorOptions, type FlowEditorAPI } from './useFlowEditor'
export { useClipboard, type UseClipboardAPI } from './useClipboard'
export { FlowProvider, useFlowContext, type FlowProviderProps } from './FlowProvider'
```

**Step 2: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS (ESM + CJS + DTS)

**Step 3: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 4: Commit**

```
feat(flow): export useClipboard, FlowProvider, and useFlowContext from barrel
```

---
