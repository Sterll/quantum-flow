# Interaction Layer Design

**Goal:** Transform FlowCanvas from a read-only viewer into a fully interactive node editor with drag, pan/zoom, connection creation, selection, and keyboard shortcuts.

---

## Architecture

```
FlowCanvas (store: GraphStore)
  └─ useCanvasInteraction(canvasRef, store, options)
       ├─ useViewport()           → { offset, zoom, screenToWorld, worldToScreen, ref }
       ├─ useNodeDrag(store, vp)  → { dragging: string | null }
       ├─ useConnection(store, vp)→ { draft: DraftConnection | null }
       ├─ useSelection(store, vp) → { selected: Set<string>, rubberBand: Rect | null }
       └─ useHotkeys(store, sel)  → void (side-effects only)
```

**Shared utility:** `hitTest.ts` — pure functions for detecting what's under the cursor:
- `hitTestNode(worldPos, nodes): FlowNode | null`
- `hitTestPin(worldPos, nodes): { nodeId, pinId, isOutput, pos } | null`

---

## Props (FlowCanvas)

```typescript
interface FlowCanvasProps {
  store: GraphStore              // Controlled mode
  theme?: FlowTheme
  readOnly?: boolean             // Disables all interactions
  snapToGrid?: number            // Snap in pixels (default: 0 = off)
  onSelectionChange?: (ids: Set<string>) => void
  width?: number | string
  height?: number | string
}
```

Old callbacks (`onGraphChange`, `onConnect`, `onNodeMove`, `graph`) are removed. The parent observes the `store.events` directly.

---

## useViewport

**State (ref-based, no re-renders):**
```typescript
interface ViewportState {
  offset: { x: number; y: number }
  zoom: number  // 0.1 → 3.0
}
```

**API:**
```typescript
interface ViewportAPI {
  offset: { x: number; y: number }
  zoom: number
  screenToWorld(sx: number, sy: number): { x: number; y: number }
  worldToScreen(wx: number, wy: number): { x: number; y: number }
  ref: React.MutableRefObject<ViewportState>
}
```

**Behavior:**
- Wheel → zoom centered on cursor (factor 1.1 per tick, min 0.1, max 3.0)
- Right-click drag → pan
- Context menu prevented on right-click

---

## useNodeDrag

**Behavior:**
- Mousedown on node (via hitTest) → enter drag mode
- Mousemove → `store.moveNode(nodeId, worldPos - grabOffset)`
- Mouseup → end drag
- If `snapToGrid`, positions are rounded
- Multi-node drag: if node is in selection, all selected nodes move together
- Only the final position is committed (not every frame), so HistoryManager records one undo step

---

## useConnection

**Draft state:**
```typescript
interface DraftConnection {
  fromNodeId: string
  fromPinId: string
  fromPos: { x: number; y: number }
  toPos: { x: number; y: number }
  isFromOutput: boolean
}
```

**Behavior:**
- Mousedown on pin → enter connection mode
- Mousemove → update draft toPos (cursor position)
- Mouseup on compatible pin → `store.addConnection(...)` (Validator handles type checks, cycles, etc.)
- Mouseup elsewhere → cancel
- Can start from output OR input pin (direction is inverted)

---

## useSelection

**Behavior:**
- Click on node → select (deselect others)
- Shift+Click → toggle in selection
- Click on empty canvas → deselect all
- Drag on empty canvas → rubber-band rectangle, selects all intersected nodes
- State: `Set<string>` of node IDs

---

## useHotkeys

- Delete/Backspace → remove selected nodes (in a `store.batch()`)
- Ctrl+A → select all
- Disabled when `readOnly === true`

---

## Rendering Updates

1. **rAF loop:** `requestAnimationFrame` re-draws when viewport, selection, or draft changes. Uses a `needsRedraw` flag.
2. **Viewport transform:** `ctx.translate(offset.x, offset.y)` + `ctx.scale(zoom, zoom)` before drawing.
3. **Selection visual:** selected nodes get an accent outline (`#60a5fa`, 2px).
4. **Draft connection:** dashed bezier from source pin to cursor during connection drag.
5. **Rubber-band:** semi-transparent rectangle during area selection.
6. **Cursors:** `grab` default, `grabbing` during pan, `pointer` on node/pin hover.

---

## Hit Testing (hitTest.ts)

Uses rendering constants (NODE_W, TITLE_H, SLOT_H, PIN_R, PIN_Y0) to determine what's under a world-space coordinate.

- `hitTestPin` checks pin positions (output pins on right edge, input pins on left edge) with a generous hit radius (PIN_R * 2 for easier targeting).
- `hitTestNode` checks node bounding box (position → position + { NODE_W, nodeHeight }).
- Pin hit-test runs before node hit-test (pins have priority).

---

## File Structure

```
packages/flow/src/
  hooks/
    useViewport.ts
    useNodeDrag.ts
    useConnection.ts
    useSelection.ts
    useHotkeys.ts
    useCanvasInteraction.ts   // Composes all hooks
    hitTest.ts                // Pure utility functions
  components/
    FlowCanvas.tsx            // Updated to use hooks + store prop
```
