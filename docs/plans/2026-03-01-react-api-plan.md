# React API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide ergonomic React hooks (`useGraphStore`, `useHistory`, `useFlowEditor`) so consumers can set up an interactive node editor with minimal boilerplate.

**Architecture:** Three hooks in `packages/flow/src/react/`. `useGraphStore` creates a stable GraphStore. `useHistory` wraps HistoryManager with reactive `canUndo`/`canRedo`. `useFlowEditor` composes both plus convenience methods and serialization. All hooks are individually exported and also re-exported from the main barrel.

**Tech Stack:** TypeScript 5, React 18, Vitest (jsdom), pnpm monorepo, tsup bundler

---

### Task 1: useGraphStore hook — tests + implementation

**Files:**
- Create: `packages/flow/src/react/useGraphStore.ts`
- Create: `packages/flow/tests/useGraphStore.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/useGraphStore.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGraphStore } from '../src/react/useGraphStore'
import { Validator } from '../src/model/Validator'
import type { FlowGraph } from '../src/types'

describe('useGraphStore', () => {
  it('returns a GraphStore instance', () => {
    const { result } = renderHook(() => useGraphStore())
    expect(result.current).toBeDefined()
    expect(result.current.getNodes()).toEqual([])
    expect(result.current.getConnections()).toEqual([])
  })

  it('returns the same instance across re-renders', () => {
    const { result, rerender } = renderHook(() => useGraphStore())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('imports initialGraph at creation', () => {
    const graph: FlowGraph = {
      nodes: [{
        id: 'n1', type: 'test/node', label: 'Test',
        position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
      }],
      connections: [],
    }
    const { result } = renderHook(() => useGraphStore({ initialGraph: graph }))
    expect(result.current.getNodes()).toHaveLength(1)
    expect(result.current.getNode('n1')).toBeDefined()
  })

  it('applies validator when provided', () => {
    const validator = new Validator()
    validator.addRule({
      name: 'block-all',
      validate: () => ({ valid: false, reason: 'blocked' }),
    })
    const { result } = renderHook(() => useGraphStore({ validator }))
    expect(() => {
      result.current.addNode({
        id: 'n1', type: 'test/node', label: 'Test',
        position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
      })
    }).toThrow('blocked')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useGraphStore.test.ts`
Expected: FAIL — cannot find module `../src/react/useGraphStore`

**Step 3: Write the implementation**

```typescript
// packages/flow/src/react/useGraphStore.ts
import { useMemo } from 'react'
import { GraphStore } from '../model/GraphStore'
import type { FlowGraph } from '../types'
import type { Validator } from '../model/Validator'

export interface UseGraphStoreOptions {
  initialGraph?: FlowGraph
  validator?: Validator
}

export function useGraphStore(options?: UseGraphStoreOptions): GraphStore {
  return useMemo(() => {
    const store = new GraphStore({ validator: options?.validator })
    if (options?.initialGraph) {
      store.importGraph(options.initialGraph)
    }
    return store
  }, [])
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useGraphStore.test.ts`
Expected: 4 tests PASS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): add useGraphStore hook for stable store creation
```

---

### Task 2: useHistory hook — tests + implementation

**Files:**
- Create: `packages/flow/src/react/useHistory.ts`
- Create: `packages/flow/tests/useHistory.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/useHistory.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHistory } from '../src/react/useHistory'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowNode } from '../src/types'

const makeNode = (id: string): FlowNode => ({
  id, type: 'test/node', label: id,
  position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
})

describe('useHistory', () => {
  it('starts with canUndo=false and canRedo=false', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('canUndo becomes true after a store mutation', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store))
    act(() => {
      store.addNode(makeNode('n1'))
    })
    expect(result.current.canUndo).toBe(true)
  })

  it('undo restores previous state and updates canUndo/canRedo', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store))
    act(() => {
      store.addNode(makeNode('n1'))
    })
    expect(store.getNodes()).toHaveLength(1)

    act(() => {
      result.current.undo()
    })
    expect(store.getNodes()).toHaveLength(0)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it('redo re-applies the undone change', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store))
    act(() => {
      store.addNode(makeNode('n1'))
    })
    act(() => {
      result.current.undo()
    })
    act(() => {
      result.current.redo()
    })
    expect(store.getNodes()).toHaveLength(1)
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('exposes the HistoryManager instance', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store))
    expect(result.current.history).toBeDefined()
    expect(typeof result.current.history.getUndoStack).toBe('function')
  })

  it('respects maxSize option', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useHistory(store, { maxSize: 3 }))
    act(() => {
      store.addNode(makeNode('n1'))
      store.addNode(makeNode('n2'))
      store.addNode(makeNode('n3'))
      store.addNode(makeNode('n4'))
    })
    // maxSize=3 means stack is trimmed (initial + 4 adds, trimmed to 3)
    const stack = result.current.history.getUndoStack()
    expect(stack.length).toBeLessThanOrEqual(3)
  })

  it('returns same instance across re-renders', () => {
    const store = new GraphStore()
    const { result, rerender } = renderHook(() => useHistory(store))
    const first = result.current.history
    rerender()
    expect(result.current.history).toBe(first)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useHistory.test.ts`
Expected: FAIL — cannot find module `../src/react/useHistory`

**Step 3: Write the implementation**

```typescript
// packages/flow/src/react/useHistory.ts
import { useMemo, useState, useEffect, useCallback } from 'react'
import { HistoryManager } from '../model/HistoryManager'
import type { GraphStore, GraphEvents } from '../model/GraphStore'

export interface UseHistoryOptions {
  maxSize?: number
}

export interface UseHistoryAPI {
  undo(): boolean
  redo(): boolean
  canUndo: boolean
  canRedo: boolean
  history: HistoryManager
}

export function useHistory(store: GraphStore, options?: UseHistoryOptions): UseHistoryAPI {
  const manager = useMemo(
    () => new HistoryManager(store, { maxSize: options?.maxSize }),
    [store],
  )

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    const sync = () => {
      setCanUndo(manager.canUndo())
      setCanRedo(manager.canRedo())
    }

    const events: Array<keyof GraphEvents> = [
      'node:added', 'node:removed', 'node:moved', 'node:dataChanged',
      'connection:added', 'connection:removed', 'graph:cleared',
      'graph:imported', 'batch:end',
    ]

    const unsubs = events.map(event => store.events.on(event, sync))
    return () => { unsubs.forEach(unsub => unsub()) }
  }, [store, manager])

  const undo = useCallback(() => {
    const result = manager.undo()
    setCanUndo(manager.canUndo())
    setCanRedo(manager.canRedo())
    return result
  }, [manager])

  const redo = useCallback(() => {
    const result = manager.redo()
    setCanUndo(manager.canUndo())
    setCanRedo(manager.canRedo())
    return result
  }, [manager])

  return { undo, redo, canUndo, canRedo, history: manager }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useHistory.test.ts`
Expected: 7 tests PASS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): add useHistory hook with reactive canUndo/canRedo
```

---

### Task 3: useFlowEditor hook — tests + implementation

**Files:**
- Create: `packages/flow/src/react/useFlowEditor.ts`
- Create: `packages/flow/tests/useFlowEditor.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/useFlowEditor.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFlowEditor } from '../src/react/useFlowEditor'
import { Validator } from '../src/model/Validator'
import { defineNode } from '../src/define/defineNode'
import type { FlowGraph, FlowNode, FlowConnection } from '../src/types'

const makeNode = (id: string): FlowNode => ({
  id, type: 'test/node', label: id,
  position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
})

const makeConnection = (id: string, from: string, fromPin: string, to: string, toPin: string): FlowConnection => ({
  id, fromNodeId: from, fromPinId: fromPin, toNodeId: to, toPinId: toPin,
})

describe('useFlowEditor', () => {
  it('creates a store with no options', () => {
    const { result } = renderHook(() => useFlowEditor())
    expect(result.current.store).toBeDefined()
    expect(result.current.store.getNodes()).toEqual([])
  })

  it('imports initialGraph', () => {
    const graph: FlowGraph = {
      nodes: [makeNode('n1')],
      connections: [],
    }
    const { result } = renderHook(() => useFlowEditor({ initialGraph: graph }))
    expect(result.current.store.getNodes()).toHaveLength(1)
  })

  it('addNode proxies to store', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    expect(result.current.store.getNodes()).toHaveLength(1)
  })

  it('removeNode proxies to store', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    act(() => {
      result.current.removeNode('n1')
    })
    expect(result.current.store.getNodes()).toHaveLength(0)
  })

  it('addConnection and removeConnection proxy to store', () => {
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
    expect(result.current.store.getConnections()).toHaveLength(1)

    act(() => {
      result.current.removeConnection('c1')
    })
    expect(result.current.store.getConnections()).toHaveLength(0)
  })

  it('history is enabled by default with undo/redo', () => {
    const { result } = renderHook(() => useFlowEditor())
    expect(result.current.canUndo).toBe(false)

    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    expect(result.current.canUndo).toBe(true)

    act(() => {
      result.current.undo()
    })
    expect(result.current.store.getNodes()).toHaveLength(0)
    expect(result.current.canRedo).toBe(true)

    act(() => {
      result.current.redo()
    })
    expect(result.current.store.getNodes()).toHaveLength(1)
  })

  it('history: false disables undo/redo', () => {
    const { result } = renderHook(() => useFlowEditor({ history: false }))
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.undo()).toBe(false)
  })

  it('toJSON returns current graph state', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    const json = result.current.toJSON()
    expect(json.nodes).toHaveLength(1)
    expect(json.connections).toEqual([])
  })

  it('fromJSON replaces graph state', () => {
    const { result } = renderHook(() => useFlowEditor())
    act(() => {
      result.current.addNode(makeNode('n1'))
    })
    act(() => {
      result.current.fromJSON({
        nodes: [makeNode('n2'), makeNode('n3')],
        connections: [],
      })
    })
    expect(result.current.store.getNodes()).toHaveLength(2)
    expect(result.current.store.getNode('n1')).toBeUndefined()
    expect(result.current.store.getNode('n2')).toBeDefined()
  })

  it('registry is populated when definitions provided', () => {
    const branchNode = defineNode({
      type: 'logic/branch', label: 'Branch',
      inputs: [{ id: 'exec', type: 'exec', label: '' }],
      outputs: [{ id: 'true', type: 'exec', label: 'True' }, { id: 'false', type: 'exec', label: 'False' }],
    })
    const { result } = renderHook(() => useFlowEditor({ registry: [branchNode] }))
    expect(result.current.registry).not.toBeNull()
    expect(result.current.registry!.has('logic/branch')).toBe(true)
  })

  it('registry is null when no definitions provided', () => {
    const { result } = renderHook(() => useFlowEditor())
    expect(result.current.registry).toBeNull()
  })

  it('returns stable references across re-renders', () => {
    const { result, rerender } = renderHook(() => useFlowEditor())
    const first = result.current
    rerender()
    expect(result.current.store).toBe(first.store)
    expect(result.current.addNode).toBe(first.addNode)
    expect(result.current.toJSON).toBe(first.toJSON)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useFlowEditor.test.ts`
Expected: FAIL — cannot find module `../src/react/useFlowEditor`

**Step 3: Write the implementation**

```typescript
// packages/flow/src/react/useFlowEditor.ts
import { useMemo, useCallback } from 'react'
import type { FlowNode, FlowConnection, FlowGraph } from '../types'
import type { Validator } from '../model/Validator'
import type { NodeDefinitionWithFactory } from '../define/defineNode'
import { NodeRegistry } from '../define/NodeRegistry'
import { useGraphStore } from './useGraphStore'
import { useHistory, type UseHistoryAPI } from './useHistory'

export interface UseFlowEditorOptions {
  initialGraph?: FlowGraph
  validator?: Validator
  history?: boolean | { maxSize?: number }
  registry?: NodeDefinitionWithFactory[]
}

export interface FlowEditorAPI {
  store: import('../model/GraphStore').GraphStore

  undo(): boolean
  redo(): boolean
  canUndo: boolean
  canRedo: boolean

  addNode(node: FlowNode): void
  removeNode(nodeId: string): void
  addConnection(connection: FlowConnection): void
  removeConnection(connectionId: string): void

  toJSON(): FlowGraph
  fromJSON(graph: FlowGraph): void

  registry: NodeRegistry | null
}

const noopHistory: UseHistoryAPI = {
  undo: () => false,
  redo: () => false,
  canUndo: false,
  canRedo: false,
  history: null as any,
}

export function useFlowEditor(options?: UseFlowEditorOptions): FlowEditorAPI {
  const store = useGraphStore({
    initialGraph: options?.initialGraph,
    validator: options?.validator,
  })

  const historyEnabled = options?.history !== false
  const historyOptions = typeof options?.history === 'object' ? options.history : undefined
  const historyApi = historyEnabled
    ? useHistory(store, historyOptions)
    : noopHistory

  const registry = useMemo(() => {
    if (!options?.registry || options.registry.length === 0) return null
    const reg = new NodeRegistry()
    reg.registerMany(options.registry)
    return reg
  }, [])

  const addNode = useCallback((node: FlowNode) => store.addNode(node), [store])
  const removeNode = useCallback((nodeId: string) => store.removeNode(nodeId), [store])
  const addConnection = useCallback((conn: FlowConnection) => store.addConnection(conn), [store])
  const removeConnection = useCallback((connId: string) => store.removeConnection(connId), [store])
  const toJSON = useCallback(() => store.getState(), [store])
  const fromJSON = useCallback((graph: FlowGraph) => store.importGraph(graph), [store])

  return {
    store,
    undo: historyApi.undo,
    redo: historyApi.redo,
    canUndo: historyApi.canUndo,
    canRedo: historyApi.canRedo,
    addNode,
    removeNode,
    addConnection,
    removeConnection,
    toJSON,
    fromJSON,
    registry,
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useFlowEditor.test.ts`
Expected: 12 tests PASS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): add useFlowEditor hook composing store, history, and registry
```

---

### Task 4: Barrel export + integration

**Files:**
- Create: `packages/flow/src/react/index.ts`
- Modify: `packages/flow/src/index.ts` — add `export * from './react'`

**Step 1: Create barrel export**

```typescript
// packages/flow/src/react/index.ts
export { useGraphStore, type UseGraphStoreOptions } from './useGraphStore'
export { useHistory, type UseHistoryOptions, type UseHistoryAPI } from './useHistory'
export { useFlowEditor, type UseFlowEditorOptions, type FlowEditorAPI } from './useFlowEditor'
```

**Step 2: Update main index.ts**

Add `export * from './react'` to `packages/flow/src/index.ts` (before the components line).

The file should become:
```typescript
export * from './types'
export * from './model/EventBus'
export * from './model/GraphStore'
export * from './model/Validator'
export * from './model/HistoryManager'
export * from './define'
export * from './hooks'
export * from './react'
export * from './components'
```

**Step 3: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS (ESM + CJS + DTS)

**Step 4: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 5: Commit**

```
feat(flow): add react barrel export and wire into main index
```

---
