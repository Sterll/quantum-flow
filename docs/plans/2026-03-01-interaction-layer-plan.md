# Interaction Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform FlowCanvas from a read-only viewer into a fully interactive node editor with drag, pan/zoom, connection creation, selection, and keyboard shortcuts.

**Architecture:** Granular React hooks (`useViewport`, `useNodeDrag`, `useConnection`, `useSelection`, `useHotkeys`) composed by `useCanvasInteraction`. Pure `hitTest.ts` utility for spatial queries. FlowCanvas takes a `GraphStore` prop (controlled mode) and renders via rAF loop with viewport transform.

**Tech Stack:** TypeScript 5, React 18, Canvas 2D, Vitest (jsdom), pnpm monorepo, tsup bundler

---

### Task 1: hitTest utility — tests + implementation

**Files:**
- Create: `packages/flow/src/hooks/hitTest.ts`
- Create: `packages/flow/tests/hitTest.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/hitTest.test.ts
import { describe, it, expect } from 'vitest'
import { hitTestNode, hitTestPin } from '../src/hooks/hitTest'
import type { FlowNode } from '../src/types'

const makeNode = (id: string, x: number, y: number, inputs: Array<{ id: string; type: string }> = [], outputs: Array<{ id: string; type: string }> = []): FlowNode => ({
  id,
  type: 'test/node',
  label: id,
  position: { x, y },
  inputs: inputs.map(p => ({ ...p, label: p.id })),
  outputs: outputs.map(p => ({ ...p, label: p.id })),
  data: {},
})

describe('hitTest', () => {
  describe('hitTestNode', () => {
    it('returns node when point is inside bounding box', () => {
      const nodes = [makeNode('n1', 100, 100)]
      const result = hitTestNode({ x: 150, y: 120 }, nodes)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('n1')
    })

    it('returns null when point is outside all nodes', () => {
      const nodes = [makeNode('n1', 100, 100)]
      const result = hitTestNode({ x: 0, y: 0 }, nodes)
      expect(result).toBeNull()
    })

    it('returns topmost node (last in array) when overlapping', () => {
      const nodes = [
        makeNode('n1', 100, 100),
        makeNode('n2', 110, 110),
      ]
      const result = hitTestNode({ x: 150, y: 130 }, nodes)
      expect(result!.id).toBe('n2')
    })
  })

  describe('hitTestPin', () => {
    it('returns output pin when point is near right edge pin position', () => {
      const nodes = [makeNode('n1', 100, 100, [], [{ id: 'out', type: 'exec' }])]
      // Output pin is at x=100+220=320, y=100+40+11=151
      const result = hitTestPin({ x: 320, y: 151 }, nodes)
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('n1')
      expect(result!.pinId).toBe('out')
      expect(result!.isOutput).toBe(true)
    })

    it('returns input pin when point is near left edge pin position', () => {
      const nodes = [makeNode('n1', 100, 100, [{ id: 'in', type: 'string' }], [])]
      // Input pin is at x=100, y=100+40+11=151
      const result = hitTestPin({ x: 100, y: 151 }, nodes)
      expect(result).not.toBeNull()
      expect(result!.nodeId).toBe('n1')
      expect(result!.pinId).toBe('in')
      expect(result!.isOutput).toBe(false)
    })

    it('returns null when no pin is near the point', () => {
      const nodes = [makeNode('n1', 100, 100, [{ id: 'in', type: 'string' }], [])]
      const result = hitTestPin({ x: 200, y: 200 }, nodes)
      expect(result).toBeNull()
    })

    it('pin hit takes priority with generous radius', () => {
      const nodes = [makeNode('n1', 100, 100, [{ id: 'in', type: 'exec' }], [])]
      // Slightly off from exact pin position — within 10px radius
      const result = hitTestPin({ x: 105, y: 155 }, nodes)
      expect(result).not.toBeNull()
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/hitTest.test.ts`
Expected: FAIL — cannot find module `../src/hooks/hitTest`

**Step 3: Write the implementation**

```typescript
// packages/flow/src/hooks/hitTest.ts
import type { FlowNode } from '../types'

const TITLE_H = 30
const SLOT_H = 22
const PIN_Y0 = TITLE_H + 10
const NODE_W = 220
const HIT_RADIUS = 10

interface Vec2 { x: number; y: number }

export interface PinHit {
  nodeId: string
  pinId: string
  isOutput: boolean
  pos: Vec2
}

export function nodeHeight(node: FlowNode): number {
  const rows = Math.max(node.inputs.length, node.outputs.length)
  return rows === 0 ? TITLE_H + 14 : PIN_Y0 + rows * SLOT_H + 8
}

export function hitTestPin(worldPos: Vec2, nodes: FlowNode[]): PinHit | null {
  // Iterate in reverse so topmost (last rendered) nodes get priority
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    const w = node.width ?? NODE_W

    // Check output pins (right edge)
    for (let j = 0; j < node.outputs.length; j++) {
      const px = node.position.x + w
      const py = node.position.y + PIN_Y0 + j * SLOT_H + SLOT_H * 0.5
      const dx = worldPos.x - px
      const dy = worldPos.y - py
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) {
        return { nodeId: node.id, pinId: node.outputs[j].id, isOutput: true, pos: { x: px, y: py } }
      }
    }

    // Check input pins (left edge)
    for (let j = 0; j < node.inputs.length; j++) {
      const px = node.position.x
      const py = node.position.y + PIN_Y0 + j * SLOT_H + SLOT_H * 0.5
      const dx = worldPos.x - px
      const dy = worldPos.y - py
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) {
        return { nodeId: node.id, pinId: node.inputs[j].id, isOutput: false, pos: { x: px, y: py } }
      }
    }
  }
  return null
}

export function hitTestNode(worldPos: Vec2, nodes: FlowNode[]): FlowNode | null {
  // Iterate in reverse so topmost (last rendered) nodes get priority
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    const w = node.width ?? NODE_W
    const h = nodeHeight(node)
    if (
      worldPos.x >= node.position.x &&
      worldPos.x <= node.position.x + w &&
      worldPos.y >= node.position.y &&
      worldPos.y <= node.position.y + h
    ) {
      return node
    }
  }
  return null
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/hitTest.test.ts`
Expected: 7 tests PASS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass (no regressions)

**Step 6: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 7: Commit**

```
feat(flow): add hitTest utility for node and pin spatial queries
```

---

### Task 2: useViewport hook — tests + implementation

**Files:**
- Create: `packages/flow/src/hooks/useViewport.ts`
- Create: `packages/flow/tests/useViewport.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/useViewport.test.ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewport } from '../src/hooks/useViewport'

describe('useViewport', () => {
  it('starts with default offset {0,0} and zoom 1', () => {
    const { result } = renderHook(() => useViewport())
    expect(result.current.ref.current.offset).toEqual({ x: 0, y: 0 })
    expect(result.current.ref.current.zoom).toBe(1)
  })

  it('screenToWorld converts screen coords to world coords', () => {
    const { result } = renderHook(() => useViewport())
    // At zoom 1, offset 0: screen === world
    const world = result.current.screenToWorld(100, 200)
    expect(world.x).toBe(100)
    expect(world.y).toBe(200)
  })

  it('screenToWorld accounts for offset and zoom', () => {
    const { result } = renderHook(() => useViewport())
    act(() => {
      result.current.ref.current.offset = { x: 50, y: 50 }
      result.current.ref.current.zoom = 2
    })
    // world = (screen - offset) / zoom
    const world = result.current.screenToWorld(150, 250)
    expect(world.x).toBe(50)
    expect(world.y).toBe(100)
  })

  it('worldToScreen converts world coords to screen coords', () => {
    const { result } = renderHook(() => useViewport())
    act(() => {
      result.current.ref.current.offset = { x: 50, y: 50 }
      result.current.ref.current.zoom = 2
    })
    // screen = world * zoom + offset
    const screen = result.current.worldToScreen(50, 100)
    expect(screen.x).toBe(150)
    expect(screen.y).toBe(250)
  })

  it('pan updates offset', () => {
    const { result } = renderHook(() => useViewport())
    act(() => {
      result.current.pan(30, -20)
    })
    expect(result.current.ref.current.offset).toEqual({ x: 30, y: -20 })
  })

  it('zoomAt adjusts zoom and offset to keep point stable', () => {
    const { result } = renderHook(() => useViewport())
    act(() => {
      result.current.zoomAt(1.5, 100, 100)
    })
    expect(result.current.ref.current.zoom).toBe(1.5)
    // Offset should compensate so the point at (100,100) stays in place
    // newOffset.x = screenX - worldX * newZoom = 100 - 100 * 1.5 = -50
    expect(result.current.ref.current.offset.x).toBe(-50)
    expect(result.current.ref.current.offset.y).toBe(-50)
  })

  it('clamps zoom between 0.1 and 3.0', () => {
    const { result } = renderHook(() => useViewport())
    act(() => {
      result.current.zoomAt(0.01, 0, 0)
    })
    expect(result.current.ref.current.zoom).toBe(0.1)

    act(() => {
      result.current.zoomAt(5, 0, 0)
    })
    expect(result.current.ref.current.zoom).toBe(3.0)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useViewport.test.ts`
Expected: FAIL — cannot find module `../src/hooks/useViewport`

**Important:** Before writing tests, install `@testing-library/react` if not already present:
Run: `pnpm --filter @quantum-studios/flow add -D @testing-library/react`

**Step 3: Write the implementation**

```typescript
// packages/flow/src/hooks/useViewport.ts
import { useRef, useCallback } from 'react'

export interface ViewportState {
  offset: { x: number; y: number }
  zoom: number
}

const ZOOM_MIN = 0.1
const ZOOM_MAX = 3.0

export interface ViewportAPI {
  ref: React.MutableRefObject<ViewportState>
  screenToWorld(sx: number, sy: number): { x: number; y: number }
  worldToScreen(wx: number, wy: number): { x: number; y: number }
  pan(dx: number, dy: number): void
  zoomAt(newZoom: number, screenX: number, screenY: number): void
}

export function useViewport(): ViewportAPI {
  const ref = useRef<ViewportState>({
    offset: { x: 0, y: 0 },
    zoom: 1,
  })

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const { offset, zoom } = ref.current
    return {
      x: (sx - offset.x) / zoom,
      y: (sy - offset.y) / zoom,
    }
  }, [])

  const worldToScreen = useCallback((wx: number, wy: number) => {
    const { offset, zoom } = ref.current
    return {
      x: wx * zoom + offset.x,
      y: wy * zoom + offset.y,
    }
  }, [])

  const pan = useCallback((dx: number, dy: number) => {
    ref.current.offset = {
      x: ref.current.offset.x + dx,
      y: ref.current.offset.y + dy,
    }
  }, [])

  const zoomAt = useCallback((newZoom: number, screenX: number, screenY: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom))
    const { offset, zoom: oldZoom } = ref.current
    // World point under cursor before zoom
    const wx = (screenX - offset.x) / oldZoom
    const wy = (screenY - offset.y) / oldZoom
    // New offset so the same world point stays under cursor
    ref.current.zoom = clamped
    ref.current.offset = {
      x: screenX - wx * clamped,
      y: screenY - wy * clamped,
    }
  }, [])

  return { ref, screenToWorld, worldToScreen, pan, zoomAt }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useViewport.test.ts`
Expected: 7 tests PASS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 7: Commit**

```
feat(flow): add useViewport hook with pan, zoom-at-cursor, and coord transforms
```

---

### Task 3: useNodeDrag hook — tests + implementation

**Files:**
- Create: `packages/flow/src/hooks/useNodeDrag.ts`
- Create: `packages/flow/tests/useNodeDrag.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/useNodeDrag.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNodeDrag } from '../src/hooks/useNodeDrag'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowNode } from '../src/types'
import type { ViewportAPI } from '../src/hooks/useViewport'

const makeNode = (id: string, x: number, y: number): FlowNode => ({
  id, type: 'test/node', label: id, position: { x, y }, inputs: [], outputs: [], data: {},
})

function makeViewport(offset = { x: 0, y: 0 }, zoom = 1): ViewportAPI {
  const ref = { current: { offset, zoom } }
  return {
    ref: ref as any,
    screenToWorld: (sx: number, sy: number) => ({
      x: (sx - ref.current.offset.x) / ref.current.zoom,
      y: (sy - ref.current.offset.y) / ref.current.zoom,
    }),
    worldToScreen: (wx: number, wy: number) => ({
      x: wx * ref.current.zoom + ref.current.offset.x,
      y: wy * ref.current.zoom + ref.current.offset.y,
    }),
    pan: vi.fn(),
    zoomAt: vi.fn(),
  }
}

describe('useNodeDrag', () => {
  it('starts with no dragging', () => {
    const store = new GraphStore()
    const vp = makeViewport()
    const { result } = renderHook(() => useNodeDrag(store, vp))
    expect(result.current.dragging).toBeNull()
  })

  it('startDrag sets dragging nodeId', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 100))
    const vp = makeViewport()
    const { result } = renderHook(() => useNodeDrag(store, vp))
    act(() => {
      result.current.startDrag('n1', { x: 120, y: 120 })
    })
    expect(result.current.dragging).toBe('n1')
  })

  it('moveDrag updates node position in store', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 100))
    const vp = makeViewport()
    const { result } = renderHook(() => useNodeDrag(store, vp))
    act(() => {
      result.current.startDrag('n1', { x: 120, y: 120 })
    })
    act(() => {
      result.current.moveDrag({ x: 150, y: 160 })
    })
    const node = store.getNode('n1')!
    expect(node.position.x).toBe(130) // 100 + (150 - 120)
    expect(node.position.y).toBe(140) // 100 + (160 - 120)
  })

  it('endDrag clears dragging state', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 100))
    const vp = makeViewport()
    const { result } = renderHook(() => useNodeDrag(store, vp))
    act(() => {
      result.current.startDrag('n1', { x: 120, y: 120 })
    })
    act(() => {
      result.current.endDrag()
    })
    expect(result.current.dragging).toBeNull()
  })

  it('multi-drag moves all selected nodes together', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 100))
    store.addNode(makeNode('n2', 300, 200))
    const vp = makeViewport()
    const selected = new Set(['n1', 'n2'])
    const { result } = renderHook(() => useNodeDrag(store, vp, { selected }))
    act(() => {
      result.current.startDrag('n1', { x: 120, y: 120 })
    })
    act(() => {
      result.current.moveDrag({ x: 150, y: 160 })
    })
    const n1 = store.getNode('n1')!
    const n2 = store.getNode('n2')!
    expect(n1.position).toEqual({ x: 130, y: 140 })
    expect(n2.position).toEqual({ x: 330, y: 240 })
  })

  it('snaps to grid when snapToGrid is set', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 100, 100))
    const vp = makeViewport()
    const { result } = renderHook(() => useNodeDrag(store, vp, { snapToGrid: 20 }))
    act(() => {
      result.current.startDrag('n1', { x: 100, y: 100 })
    })
    act(() => {
      result.current.moveDrag({ x: 113, y: 127 })
    })
    const node = store.getNode('n1')!
    expect(node.position.x).toBe(120) // snapped to nearest 20
    expect(node.position.y).toBe(120) // snapped to nearest 20
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useNodeDrag.test.ts`
Expected: FAIL — cannot find module

**Step 3: Write the implementation**

```typescript
// packages/flow/src/hooks/useNodeDrag.ts
import { useState, useRef, useCallback } from 'react'
import type { GraphStore } from '../model/GraphStore'
import type { ViewportAPI } from './useViewport'

interface Vec2 { x: number; y: number }

export interface NodeDragOptions {
  selected?: Set<string>
  snapToGrid?: number
}

export interface NodeDragAPI {
  dragging: string | null
  startDrag(nodeId: string, worldPos: Vec2): void
  moveDrag(worldPos: Vec2): void
  endDrag(): void
}

export function useNodeDrag(
  store: GraphStore,
  _viewport: ViewportAPI,
  options?: NodeDragOptions,
): NodeDragAPI {
  const [dragging, setDragging] = useState<string | null>(null)
  const grabOffset = useRef<Map<string, Vec2>>(new Map())

  const snap = useCallback((v: number): number => {
    const grid = options?.snapToGrid
    if (!grid || grid <= 0) return v
    return Math.round(v / grid) * grid
  }, [options?.snapToGrid])

  const startDrag = useCallback((nodeId: string, worldPos: Vec2) => {
    setDragging(nodeId)
    grabOffset.current.clear()

    const selected = options?.selected
    const dragIds = selected && selected.has(nodeId)
      ? Array.from(selected)
      : [nodeId]

    for (const id of dragIds) {
      const node = store.getNode(id)
      if (node) {
        grabOffset.current.set(id, {
          x: worldPos.x - node.position.x,
          y: worldPos.y - node.position.y,
        })
      }
    }
  }, [store, options?.selected])

  const moveDrag = useCallback((worldPos: Vec2) => {
    for (const [id, offset] of grabOffset.current) {
      store.moveNode(id, {
        x: snap(worldPos.x - offset.x),
        y: snap(worldPos.y - offset.y),
      })
    }
  }, [store, snap])

  const endDrag = useCallback(() => {
    setDragging(null)
    grabOffset.current.clear()
  }, [])

  return { dragging, startDrag, moveDrag, endDrag }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useNodeDrag.test.ts`
Expected: 6 tests PASS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): add useNodeDrag hook with multi-select and snap-to-grid
```

---

### Task 4: useSelection hook — tests + implementation

**Files:**
- Create: `packages/flow/src/hooks/useSelection.ts`
- Create: `packages/flow/tests/useSelection.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/useSelection.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSelection } from '../src/hooks/useSelection'

describe('useSelection', () => {
  it('starts with empty selection', () => {
    const { result } = renderHook(() => useSelection())
    expect(result.current.selected.size).toBe(0)
  })

  it('select replaces the selection with a single node', () => {
    const { result } = renderHook(() => useSelection())
    act(() => {
      result.current.select('n1')
    })
    expect(result.current.selected.has('n1')).toBe(true)
    expect(result.current.selected.size).toBe(1)
  })

  it('select replaces previous selection', () => {
    const { result } = renderHook(() => useSelection())
    act(() => {
      result.current.select('n1')
    })
    act(() => {
      result.current.select('n2')
    })
    expect(result.current.selected.has('n1')).toBe(false)
    expect(result.current.selected.has('n2')).toBe(true)
  })

  it('toggle adds to selection', () => {
    const { result } = renderHook(() => useSelection())
    act(() => {
      result.current.select('n1')
    })
    act(() => {
      result.current.toggle('n2')
    })
    expect(result.current.selected.has('n1')).toBe(true)
    expect(result.current.selected.has('n2')).toBe(true)
  })

  it('toggle removes if already selected', () => {
    const { result } = renderHook(() => useSelection())
    act(() => {
      result.current.select('n1')
    })
    act(() => {
      result.current.toggle('n1')
    })
    expect(result.current.selected.has('n1')).toBe(false)
  })

  it('clear empties the selection', () => {
    const { result } = renderHook(() => useSelection())
    act(() => {
      result.current.select('n1')
    })
    act(() => {
      result.current.clear()
    })
    expect(result.current.selected.size).toBe(0)
  })

  it('selectAll sets all provided IDs', () => {
    const { result } = renderHook(() => useSelection())
    act(() => {
      result.current.selectAll(['n1', 'n2', 'n3'])
    })
    expect(result.current.selected.size).toBe(3)
  })

  it('setRubberBand / clearRubberBand manage rubber-band rect', () => {
    const { result } = renderHook(() => useSelection())
    act(() => {
      result.current.setRubberBand({ x: 10, y: 20, w: 100, h: 50 })
    })
    expect(result.current.rubberBand).toEqual({ x: 10, y: 20, w: 100, h: 50 })
    act(() => {
      result.current.clearRubberBand()
    })
    expect(result.current.rubberBand).toBeNull()
  })

  it('calls onSelectionChange callback when selection changes', () => {
    const cb = vi.fn()
    const { result } = renderHook(() => useSelection({ onSelectionChange: cb }))
    act(() => {
      result.current.select('n1')
    })
    expect(cb).toHaveBeenCalledWith(new Set(['n1']))
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useSelection.test.ts`
Expected: FAIL — cannot find module

**Step 3: Write the implementation**

```typescript
// packages/flow/src/hooks/useSelection.ts
import { useState, useCallback, useRef, useEffect } from 'react'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface SelectionOptions {
  onSelectionChange?: (selected: Set<string>) => void
}

export interface SelectionAPI {
  selected: Set<string>
  rubberBand: Rect | null
  select(nodeId: string): void
  toggle(nodeId: string): void
  clear(): void
  selectAll(nodeIds: string[]): void
  setRubberBand(rect: Rect): void
  clearRubberBand(): void
}

export function useSelection(options?: SelectionOptions): SelectionAPI {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rubberBand, setRubberBandState] = useState<Rect | null>(null)
  const cbRef = useRef(options?.onSelectionChange)
  cbRef.current = options?.onSelectionChange

  useEffect(() => {
    cbRef.current?.(selected)
  }, [selected])

  const select = useCallback((nodeId: string) => {
    setSelected(new Set([nodeId]))
  }, [])

  const toggle = useCallback((nodeId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setSelected(new Set())
  }, [])

  const selectAll = useCallback((nodeIds: string[]) => {
    setSelected(new Set(nodeIds))
  }, [])

  const setRubberBand = useCallback((rect: Rect) => {
    setRubberBandState(rect)
  }, [])

  const clearRubberBand = useCallback(() => {
    setRubberBandState(null)
  }, [])

  return { selected, rubberBand, select, toggle, clear, selectAll, setRubberBand, clearRubberBand }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useSelection.test.ts`
Expected: 9 tests PASS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): add useSelection hook with toggle, rubber-band, and selectAll
```

---

### Task 5: useConnection hook — tests + implementation

**Files:**
- Create: `packages/flow/src/hooks/useConnection.ts`
- Create: `packages/flow/tests/useConnection.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/useConnection.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConnection } from '../src/hooks/useConnection'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowNode } from '../src/types'

const makeNode = (id: string, x: number, y: number, inputs: Array<{ id: string; type: string }> = [], outputs: Array<{ id: string; type: string }> = []): FlowNode => ({
  id, type: 'test/node', label: id, position: { x, y },
  inputs: inputs.map(p => ({ ...p, label: p.id })),
  outputs: outputs.map(p => ({ ...p, label: p.id })),
  data: {},
})

describe('useConnection', () => {
  it('starts with no draft', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useConnection(store))
    expect(result.current.draft).toBeNull()
  })

  it('startConnection sets the draft', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useConnection(store))
    act(() => {
      result.current.startConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    expect(result.current.draft).not.toBeNull()
    expect(result.current.draft!.fromNodeId).toBe('n1')
    expect(result.current.draft!.fromPinId).toBe('out')
  })

  it('updateDraft updates the cursor position', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useConnection(store))
    act(() => {
      result.current.startConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    act(() => {
      result.current.updateDraft({ x: 200, y: 300 })
    })
    expect(result.current.draft!.toPos).toEqual({ x: 200, y: 300 })
  })

  it('cancelConnection clears the draft', () => {
    const store = new GraphStore()
    const { result } = renderHook(() => useConnection(store))
    act(() => {
      result.current.startConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    act(() => {
      result.current.cancelConnection()
    })
    expect(result.current.draft).toBeNull()
  })

  it('finishConnection adds connection to store (output→input)', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 0, 0, [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', 200, 0, [{ id: 'in', type: 'exec' }], []))
    const { result } = renderHook(() => useConnection(store))
    act(() => {
      result.current.startConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    act(() => {
      result.current.finishConnection({
        nodeId: 'n2', pinId: 'in', isOutput: false, pos: { x: 200, y: 100 },
      })
    })
    expect(store.getConnections()).toHaveLength(1)
    expect(result.current.draft).toBeNull()
  })

  it('finishConnection adds connection (input→output, reversed)', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 0, 0, [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', 200, 0, [{ id: 'in', type: 'exec' }], []))
    const { result } = renderHook(() => useConnection(store))
    // Start from input pin
    act(() => {
      result.current.startConnection({
        nodeId: 'n2', pinId: 'in', isOutput: false, pos: { x: 200, y: 100 },
      })
    })
    // Finish on output pin
    act(() => {
      result.current.finishConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    const conns = store.getConnections()
    expect(conns).toHaveLength(1)
    // Connection should always be from output to input
    expect(conns[0].fromNodeId).toBe('n1')
    expect(conns[0].toNodeId).toBe('n2')
  })

  it('finishConnection on same direction pin (output→output) cancels', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1', 0, 0, [], [{ id: 'out', type: 'exec' }]))
    store.addNode(makeNode('n2', 200, 0, [], [{ id: 'out2', type: 'exec' }]))
    const { result } = renderHook(() => useConnection(store))
    act(() => {
      result.current.startConnection({
        nodeId: 'n1', pinId: 'out', isOutput: true, pos: { x: 100, y: 100 },
      })
    })
    act(() => {
      result.current.finishConnection({
        nodeId: 'n2', pinId: 'out2', isOutput: true, pos: { x: 200, y: 100 },
      })
    })
    expect(store.getConnections()).toHaveLength(0)
    expect(result.current.draft).toBeNull()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useConnection.test.ts`
Expected: FAIL — cannot find module

**Step 3: Write the implementation**

```typescript
// packages/flow/src/hooks/useConnection.ts
import { useState, useCallback } from 'react'
import type { GraphStore } from '../model/GraphStore'
import type { PinHit } from './hitTest'

interface Vec2 { x: number; y: number }

export interface DraftConnection {
  fromNodeId: string
  fromPinId: string
  fromPos: Vec2
  toPos: Vec2
  isFromOutput: boolean
}

export interface ConnectionAPI {
  draft: DraftConnection | null
  startConnection(pin: PinHit): void
  updateDraft(worldPos: Vec2): void
  finishConnection(pin: PinHit): void
  cancelConnection(): void
}

function generateConnectionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useConnection(store: GraphStore): ConnectionAPI {
  const [draft, setDraft] = useState<DraftConnection | null>(null)

  const startConnection = useCallback((pin: PinHit) => {
    setDraft({
      fromNodeId: pin.nodeId,
      fromPinId: pin.pinId,
      fromPos: pin.pos,
      toPos: pin.pos,
      isFromOutput: pin.isOutput,
    })
  }, [])

  const updateDraft = useCallback((worldPos: Vec2) => {
    setDraft(prev => prev ? { ...prev, toPos: worldPos } : null)
  }, [])

  const finishConnection = useCallback((pin: PinHit) => {
    setDraft(current => {
      if (!current) return null

      // Both pins must be different directions (one output, one input)
      if (current.isFromOutput === pin.isOutput) {
        // Same direction — cancel
        return null
      }

      // Determine from (output) and to (input)
      const fromNodeId = current.isFromOutput ? current.fromNodeId : pin.nodeId
      const fromPinId = current.isFromOutput ? current.fromPinId : pin.pinId
      const toNodeId = current.isFromOutput ? pin.nodeId : current.fromNodeId
      const toPinId = current.isFromOutput ? pin.pinId : current.fromPinId

      try {
        store.addConnection({
          id: generateConnectionId(),
          fromNodeId,
          fromPinId,
          toNodeId,
          toPinId,
        })
      } catch {
        // Validation failed — silently cancel
      }

      return null
    })
  }, [store])

  const cancelConnection = useCallback(() => {
    setDraft(null)
  }, [])

  return { draft, startConnection, updateDraft, finishConnection, cancelConnection }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useConnection.test.ts`
Expected: 7 tests PASS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): add useConnection hook with draft preview and bidirectional start
```

---

### Task 6: useHotkeys hook — tests + implementation

**Files:**
- Create: `packages/flow/src/hooks/useHotkeys.ts`
- Create: `packages/flow/tests/useHotkeys.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/flow/tests/useHotkeys.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHotkeys } from '../src/hooks/useHotkeys'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowNode } from '../src/types'

const makeNode = (id: string): FlowNode => ({
  id, type: 'test/node', label: id, position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
})

describe('useHotkeys', () => {
  it('handleKeyDown with Delete removes selected nodes', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    const selected = new Set(['n1'])
    const clearSelection = vi.fn()

    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(store.getNodes()).toHaveLength(1)
    expect(store.getNode('n1')).toBeUndefined()
    expect(clearSelection).toHaveBeenCalled()
  })

  it('handleKeyDown with Backspace also deletes', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const selected = new Set(['n1'])
    const clearSelection = vi.fn()

    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }))

    expect(store.getNodes()).toHaveLength(0)
  })

  it('handleKeyDown with Ctrl+A calls selectAll', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    const selected = new Set<string>()
    const selectAll = vi.fn()

    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection: vi.fn(), selectAll }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }))

    expect(selectAll).toHaveBeenCalledWith(['n1', 'n2'])
  })

  it('does nothing when readOnly is true', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    const selected = new Set(['n1'])
    const clearSelection = vi.fn()

    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection, readOnly: true }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(store.getNodes()).toHaveLength(1) // Not deleted
    expect(clearSelection).not.toHaveBeenCalled()
  })

  it('delete batches removal of multiple selected nodes', () => {
    const store = new GraphStore()
    store.addNode(makeNode('n1'))
    store.addNode(makeNode('n2'))
    store.addNode(makeNode('n3'))
    const selected = new Set(['n1', 'n2'])
    const clearSelection = vi.fn()
    const batchSpy = vi.spyOn(store, 'batch')

    const { result } = renderHook(() => useHotkeys(store, { selected, clearSelection }))
    result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'Delete' }))

    expect(batchSpy).toHaveBeenCalled()
    expect(store.getNodes()).toHaveLength(1)
    expect(store.getNode('n3')).toBeDefined()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useHotkeys.test.ts`
Expected: FAIL — cannot find module

**Step 3: Write the implementation**

```typescript
// packages/flow/src/hooks/useHotkeys.ts
import { useCallback } from 'react'
import type { GraphStore } from '../model/GraphStore'

export interface HotkeyOptions {
  selected: Set<string>
  clearSelection: () => void
  selectAll?: (nodeIds: string[]) => void
  readOnly?: boolean
}

export interface HotkeysAPI {
  handleKeyDown(e: KeyboardEvent): void
}

export function useHotkeys(store: GraphStore, options: HotkeyOptions): HotkeysAPI {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (options.readOnly) return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (options.selected.size === 0) return
      store.batch(() => {
        for (const nodeId of options.selected) {
          store.removeNode(nodeId)
        }
      })
      options.clearSelection()
      e.preventDefault()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      const allIds = store.getNodes().map(n => n.id)
      options.selectAll?.(allIds)
      e.preventDefault()
      return
    }
  }, [store, options])

  return { handleKeyDown }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @quantum-studios/flow test -- tests/useHotkeys.test.ts`
Expected: 5 tests PASS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): add useHotkeys hook with Delete, Backspace, and Ctrl+A
```

---

### Task 7: useCanvasInteraction + hooks barrel export

**Files:**
- Create: `packages/flow/src/hooks/useCanvasInteraction.ts`
- Create: `packages/flow/src/hooks/index.ts`
- Modify: `packages/flow/src/index.ts` — add hooks export

**Step 1: Write useCanvasInteraction**

This hook composes all the hooks and wires mouse/keyboard events to the canvas.

```typescript
// packages/flow/src/hooks/useCanvasInteraction.ts
import { useEffect, useCallback, useRef } from 'react'
import type { GraphStore } from '../model/GraphStore'
import { useViewport, type ViewportAPI } from './useViewport'
import { useNodeDrag, type NodeDragAPI } from './useNodeDrag'
import { useConnection, type ConnectionAPI, type DraftConnection } from './useConnection'
import { useSelection, type SelectionAPI, type Rect } from './useSelection'
import { useHotkeys } from './useHotkeys'
import { hitTestPin, hitTestNode, nodeHeight } from './hitTest'

const NODE_W = 220
const ZOOM_FACTOR = 1.1

export interface CanvasInteractionOptions {
  readOnly?: boolean
  snapToGrid?: number
  onSelectionChange?: (ids: Set<string>) => void
}

export interface CanvasInteractionAPI {
  viewport: ViewportAPI
  selection: SelectionAPI
  nodeDrag: NodeDragAPI
  connection: ConnectionAPI
  needsRedraw: React.MutableRefObject<boolean>
  attach(canvas: HTMLCanvasElement): () => void
}

export function useCanvasInteraction(
  store: GraphStore,
  options?: CanvasInteractionOptions,
): CanvasInteractionAPI {
  const needsRedraw = useRef(true)

  const viewport = useViewport()
  const selection = useSelection({ onSelectionChange: options?.onSelectionChange })
  const nodeDrag = useNodeDrag(store, viewport, {
    selected: selection.selected,
    snapToGrid: options?.snapToGrid,
  })
  const connection = useConnection(store)
  const hotkeys = useHotkeys(store, {
    selected: selection.selected,
    clearSelection: selection.clear,
    selectAll: selection.selectAll,
    readOnly: options?.readOnly,
  })

  // Rubber-band drag state (not in a hook — local refs)
  const rubberStart = useRef<{ x: number; y: number } | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  const markDirty = useCallback(() => {
    needsRedraw.current = true
  }, [])

  const attach = useCallback((canvas: HTMLCanvasElement): (() => void) => {
    const getWorldPos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      return { screen: { x: sx, y: sy }, world: viewport.screenToWorld(sx, sy) }
    }

    const onMouseDown = (e: MouseEvent) => {
      if (options?.readOnly) return

      // Right-click → pan
      if (e.button === 2) {
        isPanning.current = true
        panStart.current = { x: e.clientX, y: e.clientY }
        canvas.style.cursor = 'grabbing'
        markDirty()
        return
      }

      if (e.button !== 0) return

      const { world } = getWorldPos(e)
      const nodes = store.getNodes()

      // Check pins first
      const pinHit = hitTestPin(world, nodes)
      if (pinHit) {
        connection.startConnection(pinHit)
        markDirty()
        return
      }

      // Check nodes
      const nodeHit = hitTestNode(world, nodes)
      if (nodeHit) {
        if (e.shiftKey) {
          selection.toggle(nodeHit.id)
        } else if (!selection.selected.has(nodeHit.id)) {
          selection.select(nodeHit.id)
        }
        nodeDrag.startDrag(nodeHit.id, world)
        canvas.style.cursor = 'grabbing'
        markDirty()
        return
      }

      // Empty canvas click — start rubber-band or clear selection
      if (!e.shiftKey) {
        selection.clear()
      }
      rubberStart.current = world
      markDirty()
    }

    const onMouseMove = (e: MouseEvent) => {
      const { screen, world } = getWorldPos(e)

      // Panning
      if (isPanning.current) {
        const dx = e.clientX - panStart.current.x
        const dy = e.clientY - panStart.current.y
        panStart.current = { x: e.clientX, y: e.clientY }
        viewport.pan(dx, dy)
        markDirty()
        return
      }

      // Node dragging
      if (nodeDrag.dragging) {
        nodeDrag.moveDrag(world)
        markDirty()
        return
      }

      // Connection dragging
      if (connection.draft) {
        connection.updateDraft(world)
        markDirty()
        return
      }

      // Rubber-band
      if (rubberStart.current) {
        const rx = Math.min(rubberStart.current.x, world.x)
        const ry = Math.min(rubberStart.current.y, world.y)
        const rw = Math.abs(world.x - rubberStart.current.x)
        const rh = Math.abs(world.y - rubberStart.current.y)
        selection.setRubberBand({ x: rx, y: ry, w: rw, h: rh })

        // Select nodes inside rubber-band
        const nodes = store.getNodes()
        const inside = nodes.filter(n => {
          const nw = n.width ?? NODE_W
          const nh = nodeHeight(n)
          return n.position.x + nw > rx && n.position.x < rx + rw
            && n.position.y + nh > ry && n.position.y < ry + rh
        })
        selection.selectAll(inside.map(n => n.id))
        markDirty()
        return
      }

      // Hover cursor
      if (options?.readOnly) return
      const nodes = store.getNodes()
      const pin = hitTestPin(world, nodes)
      if (pin) {
        canvas.style.cursor = 'crosshair'
        return
      }
      const node = hitTestNode(world, nodes)
      canvas.style.cursor = node ? 'grab' : 'default'
    }

    const onMouseUp = (e: MouseEvent) => {
      // End pan
      if (isPanning.current) {
        isPanning.current = false
        canvas.style.cursor = 'default'
        markDirty()
        return
      }

      // End node drag
      if (nodeDrag.dragging) {
        nodeDrag.endDrag()
        canvas.style.cursor = 'grab'
        markDirty()
        return
      }

      // End connection
      if (connection.draft) {
        const { world } = getWorldPos(e)
        const nodes = store.getNodes()
        const pinHit = hitTestPin(world, nodes)
        if (pinHit) {
          connection.finishConnection(pinHit)
        } else {
          connection.cancelConnection()
        }
        markDirty()
        return
      }

      // End rubber-band
      if (rubberStart.current) {
        rubberStart.current = null
        selection.clearRubberBand()
        markDirty()
        return
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const direction = e.deltaY < 0 ? 1 : -1
      const newZoom = viewport.ref.current.zoom * (direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR)
      viewport.zoomAt(newZoom, sx, sy)
      markDirty()
    }

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      hotkeys.handleKeyDown(e)
      markDirty()
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onContextMenu)
    canvas.setAttribute('tabindex', '0')
    canvas.addEventListener('keydown', onKeyDown)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('keydown', onKeyDown)
    }
  }, [store, viewport, nodeDrag, connection, selection, hotkeys, options?.readOnly, markDirty])

  return { viewport, selection, nodeDrag, connection, needsRedraw, attach }
}
```

**Step 2: Create barrel export**

```typescript
// packages/flow/src/hooks/index.ts
export { hitTestNode, hitTestPin, nodeHeight, type PinHit } from './hitTest'
export { useViewport, type ViewportAPI, type ViewportState } from './useViewport'
export { useNodeDrag, type NodeDragAPI, type NodeDragOptions } from './useNodeDrag'
export { useConnection, type ConnectionAPI, type DraftConnection } from './useConnection'
export { useSelection, type SelectionAPI, type SelectionOptions, type Rect } from './useSelection'
export { useHotkeys, type HotkeysAPI, type HotkeyOptions } from './useHotkeys'
export { useCanvasInteraction, type CanvasInteractionAPI, type CanvasInteractionOptions } from './useCanvasInteraction'
```

**Step 3: Update `packages/flow/src/index.ts`**

```typescript
export * from './types'
export * from './model/EventBus'
export * from './model/GraphStore'
export * from './model/Validator'
export * from './model/HistoryManager'
export * from './define'
export * from './hooks'
export * from './components'
```

**Step 4: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 5: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 6: Commit**

```
feat(flow): add useCanvasInteraction composing all interaction hooks
```

---

### Task 8: Rewrite FlowCanvas with interaction layer + rAF loop

**Files:**
- Modify: `packages/flow/src/components/FlowCanvas.tsx`
- Modify: `packages/flow/stories/FlowCanvas.stories.tsx`

**Step 1: Rewrite FlowCanvas**

Replace the entire FlowCanvas component with:

```typescript
// packages/flow/src/components/FlowCanvas.tsx
import React, { useRef, useEffect, useCallback } from 'react'
import type { FlowGraph, FlowNode, FlowPin } from '../types'
import type { NodeDefinitionWithFactory } from '../define'
import type { GraphStore } from '../model/GraphStore'
import { useCanvasInteraction } from '../hooks/useCanvasInteraction'
import type { DraftConnection } from '../hooks/useConnection'
import type { Rect } from '../hooks/useSelection'

/* ══════════════════════════════════════════════════════════════
   FlowCanvas — Interactive Canvas 2D node editor
   Claude Terminal WorkflowGraphEngine rendering style
   ══════════════════════════════════════════════════════════════ */

export interface FlowTheme {
  canvas?: { background?: string; gridColor?: string }
  node?: { titleBar?: string; body?: string; border?: string; text?: string; subtext?: string }
  pin?: { exec?: string; string?: string; number?: string; boolean?: string; object?: string; array?: string; [k: string]: string | undefined }
  connection?: { width?: number; opacity?: number }
  selection?: { color?: string }
}

export interface FlowCanvasProps {
  store: GraphStore
  theme?: FlowTheme
  readOnly?: boolean
  snapToGrid?: number
  onSelectionChange?: (ids: Set<string>) => void
  width?: number | string
  height?: number | string
}

/* ── constants (from Claude Terminal WorkflowGraphEngine) ── */

const FONT = '-apple-system, "Segoe UI", system-ui, sans-serif'
const TITLE_H = 30
const SLOT_H = 22
const PIN_R = 4.5
const DIAMOND_R = 5
const GRID_SIZE = 20
const NODE_W = 220
const CORNER = 8
const PIN_Y0 = TITLE_H + 10

/* ── pin colors (from Claude Terminal) ── */

const PIN_COLORS: Record<string, string> = {
  exec:    '#ffffff',
  string:  '#f472b6',
  number:  '#34d399',
  boolean: '#fb923c',
  object:  '#60a5fa',
  array:   '#c084fc',
}

/* ── defaults (from Claude Terminal) ── */

const DEFAULTS = {
  bg: '#0a0a0a',
  gridColor: 'rgba(255,255,255,0.03)',
  titleBar: '#141416',
  body: '#101012',
  border: 'rgba(255,255,255,0.04)',
  text: '#bbb',
  subtext: '#888',
  wireW: 2,
  wireOpacity: 0.7,
  selectionColor: '#60a5fa',
}

/* ── helpers ── */

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function pinColor(type: string, theme: FlowTheme): string {
  return theme.pin?.[type] ?? PIN_COLORS[type] ?? '#6b7280'
}

function nodeHeight(node: FlowNode): number {
  const rows = Math.max(node.inputs.length, node.outputs.length)
  return rows === 0 ? TITLE_H + 14 : PIN_Y0 + rows * SLOT_H + 8
}

interface Vec2 { x: number; y: number }

function pinPos(node: FlowNode, pinId: string, isOutput: boolean): Vec2 | null {
  const list = isOutput ? node.outputs : node.inputs
  const idx = list.findIndex(p => p.id === pinId)
  if (idx < 0) return null
  return {
    x: node.position.x + (isOutput ? (node.width ?? NODE_W) : 0),
    y: node.position.y + PIN_Y0 + idx * SLOT_H + SLOT_H * 0.5,
  }
}

function buildConnectedPins(nodes: FlowNode[], connections: Array<{ fromNodeId: string; fromPinId: string; toNodeId: string; toPinId: string }>): Set<string> {
  const set = new Set<string>()
  for (const c of connections) {
    set.add(`${c.fromNodeId}:${c.fromPinId}:out`)
    set.add(`${c.toNodeId}:${c.toPinId}:in`)
  }
  return set
}

function buildTheme(custom?: FlowTheme): FlowTheme {
  return {
    canvas: {
      background: custom?.canvas?.background ?? DEFAULTS.bg,
      gridColor: custom?.canvas?.gridColor ?? DEFAULTS.gridColor,
    },
    node: {
      titleBar: custom?.node?.titleBar ?? DEFAULTS.titleBar,
      body: custom?.node?.body ?? DEFAULTS.body,
      border: custom?.node?.border ?? DEFAULTS.border,
      text: custom?.node?.text ?? DEFAULTS.text,
      subtext: custom?.node?.subtext ?? DEFAULTS.subtext,
    },
    pin: { ...PIN_COLORS, ...custom?.pin },
    connection: {
      width: custom?.connection?.width ?? DEFAULTS.wireW,
      opacity: custom?.connection?.opacity ?? DEFAULTS.wireOpacity,
    },
    selection: {
      color: custom?.selection?.color ?? DEFAULTS.selectionColor,
    },
  }
}

/* ── grid ── */

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, theme: FlowTheme, offsetX: number, offsetY: number, zoom: number) {
  ctx.fillStyle = theme.canvas!.background!
  ctx.fillRect(0, 0, w, h)

  const gridSize = GRID_SIZE * zoom
  if (gridSize < 4) return // too zoomed out to show grid

  ctx.strokeStyle = theme.canvas!.gridColor!
  ctx.lineWidth = 0.5
  ctx.beginPath()

  const startX = offsetX % gridSize
  const startY = offsetY % gridSize

  for (let x = startX; x < w; x += gridSize) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = startY; y < h; y += gridSize) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()
}

/* ── pins ── */

function drawPins(
  ctx: CanvasRenderingContext2D,
  node: FlowNode,
  theme: FlowTheme,
  connectedPins: Set<string>,
) {
  const x = node.position.x
  const y = node.position.y
  const w = node.width ?? NODE_W

  const drawPinList = (pins: FlowPin[], isOutput: boolean) => {
    pins.forEach((pin, i) => {
      const py = y + PIN_Y0 + i * SLOT_H + SLOT_H * 0.5
      const px = isOutput ? x + w : x
      const color = pinColor(pin.type, theme)
      const connected = connectedPins.has(`${node.id}:${pin.id}:${isOutput ? 'out' : 'in'}`)

      if (pin.type === 'exec') {
        const r = DIAMOND_R
        ctx.beginPath()
        ctx.moveTo(px, py - r)
        ctx.lineTo(px + r, py)
        ctx.lineTo(px, py + r)
        ctx.lineTo(px - r, py)
        ctx.closePath()
        if (connected) {
          ctx.fillStyle = '#ccc'
          ctx.fill()
        } else {
          ctx.strokeStyle = '#888'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      } else {
        ctx.beginPath()
        ctx.arc(px, py, PIN_R, 0, Math.PI * 2)
        if (connected) {
          ctx.save()
          ctx.shadowColor = color
          ctx.shadowBlur = 6
          ctx.fillStyle = color
          ctx.fill()
          ctx.restore()
        } else {
          ctx.strokeStyle = hexToRgba(color, 0.6)
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }

      if (pin.label) {
        ctx.fillStyle = hexToRgba(color, 0.7)
        ctx.font = `500 11px ${FONT}`
        ctx.textAlign = isOutput ? 'right' : 'left'
        ctx.textBaseline = 'middle'
        const labelX = isOutput ? px - 12 : px + 12
        ctx.fillText(pin.label, labelX, py)

        if (pin.type !== 'exec') {
          ctx.fillStyle = hexToRgba(color, 0.3)
          ctx.font = `400 9px ${FONT}`
          ctx.fillText(pin.type, labelX, py + 12)
        }
      }
    })
  }

  drawPinList(node.inputs, false)
  drawPinList(node.outputs, true)
}

/* ── node ── */

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: FlowNode,
  theme: FlowTheme,
  connectedPins: Set<string>,
  isSelected: boolean,
) {
  const x = node.position.x
  const y = node.position.y
  const w = node.width ?? NODE_W
  const h = nodeHeight(node)
  const accent = node.color ?? '#6c63ff'

  // Shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 4
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.fillStyle = theme.node!.body!
  ctx.fill()
  ctx.restore()

  // Title bar
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()
  ctx.fillStyle = theme.node!.titleBar!
  ctx.fillRect(x, y, w, TITLE_H)
  ctx.fillStyle = hexToRgba(accent, 0.18)
  ctx.fillRect(x, y, w, TITLE_H)
  ctx.fillStyle = accent
  ctx.fillRect(x, y, w, 2)
  ctx.restore()

  // Body
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()
  ctx.fillStyle = theme.node!.body!
  ctx.fillRect(x, y + TITLE_H, w, h - TITLE_H)
  const gradient = ctx.createLinearGradient(x, y + TITLE_H, x, y + TITLE_H + 18)
  gradient.addColorStop(0, hexToRgba(accent, 0.06))
  gradient.addColorStop(1, 'transparent')
  ctx.fillStyle = gradient
  ctx.fillRect(x, y + TITLE_H, w, 18)
  ctx.restore()

  // Border
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.strokeStyle = isSelected ? theme.selection!.color! : theme.node!.border!
  ctx.lineWidth = isSelected ? 2 : 0.5
  ctx.stroke()

  // Selection glow
  if (isSelected) {
    ctx.save()
    ctx.shadowColor = theme.selection!.color!
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, CORNER)
    ctx.strokeStyle = theme.selection!.color!
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }

  // Title dot
  ctx.save()
  ctx.shadowColor = accent
  ctx.shadowBlur = 4
  ctx.beginPath()
  ctx.arc(x + 12, y + TITLE_H * 0.5, 4, 0, Math.PI * 2)
  ctx.fillStyle = accent
  ctx.fill()
  ctx.restore()

  // Title text
  ctx.fillStyle = theme.node!.text!
  ctx.font = `600 12px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(node.label, x + 22, y + TITLE_H * 0.5)

  drawPins(ctx, node, theme, connectedPins)
}

/* ── connections ── */

function drawConnections(ctx: CanvasRenderingContext2D, store: GraphStore, theme: FlowTheme) {
  const nodes = store.getNodes()

  ctx.save()
  ctx.globalAlpha = theme.connection!.opacity as number
  ctx.lineWidth = theme.connection!.width as number
  ctx.lineCap = 'round'

  for (const conn of store.getConnections()) {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId)
    const toNode = nodes.find(n => n.id === conn.toNodeId)
    if (!fromNode || !toNode) continue

    const fromP = pinPos(fromNode, conn.fromPinId, true)
    const toP = pinPos(toNode, conn.toPinId, false)
    if (!fromP || !toP) continue

    const fromPin = fromNode.outputs.find(p => p.id === conn.fromPinId)
    const color = pinColor(fromPin?.type ?? 'exec', theme)
    const dx = Math.abs(toP.x - fromP.x)
    const offset = Math.max(dx * 0.5, 60)

    ctx.beginPath()
    ctx.moveTo(fromP.x, fromP.y)
    ctx.bezierCurveTo(fromP.x + offset, fromP.y, toP.x - offset, toP.y, toP.x, toP.y)
    ctx.strokeStyle = color
    ctx.stroke()
  }

  ctx.restore()
}

/* ── draft connection ── */

function drawDraftConnection(ctx: CanvasRenderingContext2D, draft: DraftConnection, theme: FlowTheme) {
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.lineWidth = (theme.connection!.width as number) ?? 2
  ctx.lineCap = 'round'
  ctx.setLineDash([6, 4])

  const from = draft.fromPos
  const to = draft.toPos
  const dx = Math.abs(to.x - from.x)
  const offset = Math.max(dx * 0.5, 60)

  ctx.beginPath()
  if (draft.isFromOutput) {
    ctx.moveTo(from.x, from.y)
    ctx.bezierCurveTo(from.x + offset, from.y, to.x - offset, to.y, to.x, to.y)
  } else {
    ctx.moveTo(from.x, from.y)
    ctx.bezierCurveTo(from.x - offset, from.y, to.x + offset, to.y, to.x, to.y)
  }
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.restore()
}

/* ── rubber-band ── */

function drawRubberBand(ctx: CanvasRenderingContext2D, rect: Rect, theme: FlowTheme) {
  const color = theme.selection!.color!
  ctx.save()
  ctx.fillStyle = hexToRgba(color.startsWith('#') ? color : '#60a5fa', 0.08)
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.strokeStyle = hexToRgba(color.startsWith('#') ? color : '#60a5fa', 0.4)
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  ctx.restore()
}

/* ── component ── */

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  store,
  theme: customTheme,
  readOnly,
  snapToGrid,
  onSelectionChange,
  width = '100%',
  height = '600px',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = buildTheme(customTheme)

  const interaction = useCanvasInteraction(store, {
    readOnly,
    snapToGrid,
    onSelectionChange,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const detach = interaction.attach(canvas)
    const dpr = window.devicePixelRatio || 1

    let rafId: number

    const paint = () => {
      if (!interaction.needsRedraw.current) {
        rafId = requestAnimationFrame(paint)
        return
      }
      interaction.needsRedraw.current = false

      const rect = canvas.getBoundingClientRect()
      const cw = rect.width
      const ch = rect.height
      canvas.width = cw * dpr
      canvas.height = ch * dpr

      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Draw grid in screen-space (before viewport transform)
      const { offset, zoom } = interaction.viewport.ref.current
      drawGrid(ctx, cw, ch, theme, offset.x, offset.y, zoom)

      // Apply viewport transform for everything else
      ctx.save()
      ctx.translate(offset.x, offset.y)
      ctx.scale(zoom, zoom)

      // Draw connections
      drawConnections(ctx, store, theme)

      // Draw nodes
      const nodes = store.getNodes()
      const connections = store.getConnections()
      const connectedPins = buildConnectedPins(nodes, connections)
      for (const node of nodes) {
        drawNode(ctx, node, theme, connectedPins, interaction.selection.selected.has(node.id))
      }

      // Draw draft connection
      if (interaction.connection.draft) {
        drawDraftConnection(ctx, interaction.connection.draft, theme)
      }

      // Draw rubber-band
      if (interaction.selection.rubberBand) {
        drawRubberBand(ctx, interaction.selection.rubberBand, theme)
      }

      ctx.restore()

      rafId = requestAnimationFrame(paint)
    }

    // Initial draw
    interaction.needsRedraw.current = true
    rafId = requestAnimationFrame(paint)

    // Also redraw on resize
    const observer = new ResizeObserver(() => {
      interaction.needsRedraw.current = true
    })
    observer.observe(canvas)

    // Redraw when store changes
    const unsub = store.events.on('graph:imported', () => {
      interaction.needsRedraw.current = true
    })

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      detach()
      unsub()
    }
  }, [store, customTheme, readOnly, snapToGrid])

  return <canvas ref={canvasRef} style={{
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    display: 'block',
    outline: 'none',
  }} />
}
```

**Step 2: Update stories to use GraphStore**

Replace `packages/flow/stories/FlowCanvas.stories.tsx` with:

```tsx
// packages/flow/stories/FlowCanvas.stories.tsx
import React, { useMemo } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { FlowCanvas } from '../src/components/FlowCanvas'
import { GraphStore } from '../src/model/GraphStore'
import type { FlowGraph } from '../src/types'

const sampleGraph: FlowGraph = {
  nodes: [
    {
      id: 'n1', type: 'event/playerJoin', label: 'On Player Join',
      position: { x: 60, y: 80 },
      inputs: [],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'player', type: 'object', label: 'Player' },
        { id: 'name', type: 'string', label: 'Name' },
      ],
      data: {}, color: '#6c63ff',
    },
    {
      id: 'n2', type: 'logic/branch', label: 'Branch',
      position: { x: 360, y: 40 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'condition', type: 'boolean', label: 'Condition' },
      ],
      outputs: [
        { id: 'true', type: 'exec', label: 'True' },
        { id: 'false', type: 'exec', label: 'False' },
      ],
      data: {}, color: '#f59e0b',
    },
    {
      id: 'n3', type: 'action/notify', label: 'Send Notification',
      position: { x: 660, y: 40 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'message', type: 'string', label: 'Message' },
        { id: 'target', type: 'object', label: 'Target' },
      ],
      outputs: [{ id: 'exec', type: 'exec', label: '' }],
      data: {}, color: '#22c55e',
    },
    {
      id: 'n4', type: 'action/log', label: 'Console Log',
      position: { x: 660, y: 260 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'text', type: 'string', label: 'Text' },
        { id: 'level', type: 'number', label: 'Level' },
      ],
      outputs: [],
      data: {}, color: '#ef4444',
    },
  ],
  connections: [
    { id: 'c1', fromNodeId: 'n1', fromPinId: 'exec', toNodeId: 'n2', toPinId: 'exec' },
    { id: 'c2', fromNodeId: 'n2', fromPinId: 'true', toNodeId: 'n3', toPinId: 'exec' },
    { id: 'c3', fromNodeId: 'n2', fromPinId: 'false', toNodeId: 'n4', toPinId: 'exec' },
    { id: 'c4', fromNodeId: 'n1', fromPinId: 'name', toNodeId: 'n3', toPinId: 'message' },
    { id: 'c5', fromNodeId: 'n1', fromPinId: 'player', toNodeId: 'n3', toPinId: 'target' },
    { id: 'c6', fromNodeId: 'n1', fromPinId: 'name', toNodeId: 'n4', toPinId: 'text' },
  ],
}

function useStore(graph: FlowGraph): GraphStore {
  return useMemo(() => {
    const store = new GraphStore()
    store.importGraph(graph)
    return store
  }, [])
}

const InteractiveCanvas = (props: { graph: FlowGraph; theme?: any; width?: number; height?: number }) => {
  const store = useStore(props.graph)
  return <FlowCanvas store={store} theme={props.theme} width={props.width} height={props.height} />
}

const meta: Meta<typeof InteractiveCanvas> = {
  title: 'FlowCanvas',
  component: InteractiveCanvas,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof InteractiveCanvas>

export const Default: Story = {
  args: {
    graph: sampleGraph,
    width: 960,
    height: 460,
  },
}

export const CrimsonTheme: Story = {
  args: {
    graph: sampleGraph,
    width: 960,
    height: 460,
    theme: {
      canvas: { background: '#0a0508', gridColor: 'rgba(255,100,100,0.02)' },
      node: { titleBar: '#1a0e12', body: '#120a0e', border: 'rgba(255,80,80,0.06)', text: '#f0d0d8', subtext: '#8a5a6a' },
      connection: { width: 2 },
    },
  },
}

export const EmptyGraph: Story = {
  args: {
    graph: { nodes: [], connections: [] },
    width: 960,
    height: 460,
  },
}
```

**Step 3: Run ALL tests**

Run: `pnpm --filter @quantum-studios/flow test`
Expected: ALL tests pass

**Step 4: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 5: Verify Storybook renders and interactions work**

Run: `pnpm --filter @quantum-studios/flow storybook`
Verify manually:
- Canvas renders correctly (same visual as before)
- Drag nodes → they move
- Right-click drag → canvas pans
- Scroll → zoom centered on cursor
- Click pin → drag → release on another pin → connection created
- Click node → selection highlight
- Shift+click → multi-select
- Drag on empty canvas → rubber-band selection
- Delete key → removes selected nodes
- Ctrl+A → selects all

**Step 6: Commit**

```
feat(flow): rewrite FlowCanvas with interactive rAF loop, viewport, selection, and connections

BREAKING CHANGE: FlowCanvas now takes `store: GraphStore` prop instead of `graph: FlowGraph`.
Old callbacks (onGraphChange, onConnect, onNodeMove) removed — use store.events instead.
```

---
