# UE-Style FlowCanvas Renderer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite FlowCanvas rendering to match Unreal Engine 5 Blueprint visual style — full-color headers, triangle exec pins, hollow/filled pin states, hierarchical line grid, type-colored bezier wires.

**Architecture:** Single-file rewrite of `FlowCanvas.tsx` rendering functions. No new files, no structural changes. Theme interface updated to support new grid/connection options. Connected pin detection via Set built from graph connections.

**Tech Stack:** React, Canvas 2D API, TypeScript

---

### Task 1: Update theme interface and constants

**Files:**
- Modify: `packages/flow/src/components/FlowCanvas.tsx:10-94`

**Step 1: Replace FlowTheme interface**

Replace the current FlowTheme and constants with:

```typescript
export interface FlowTheme {
  canvas?: {
    background?: string
    gridColor?: string
    gridMajorColor?: string
    gridSpacing?: number
    gridMajorEvery?: number
  }
  node?: {
    background?: string
    border?: string
    text?: string
    subtext?: string
  }
  pin?: {
    exec?: string
    string?: string
    number?: string
    boolean?: string
    object?: string
    array?: string
    [key: string]: string | undefined
  }
  connection?: {
    width?: number
    execColor?: string
    execWidth?: number
  }
}
```

**Step 2: Update layout constants**

```typescript
const NODE_W = 220
const HEADER_H = 32
const PIN_ROW = 24
const PIN_R = 4
const PIN_Y0 = HEADER_H + 14
const PAD_BOTTOM = 14
const CORNER = 6
const GRID_SPACING = 20
const GRID_MAJOR_EVERY = 8
```

**Step 3: Update default theme**

```typescript
const PIN_COLORS: Record<string, string> = {
  exec:    '#ffffff',
  string:  '#f472b6',
  number:  '#34d399',
  boolean: '#fb923c',
  object:  '#60a5fa',
  array:   '#c084fc',
}

const DEFAULT_THEME: Required<FlowTheme> = {
  canvas: {
    background: '#1a1a1a',
    gridColor: 'rgba(255,255,255,0.03)',
    gridMajorColor: 'rgba(255,255,255,0.07)',
    gridSpacing: GRID_SPACING,
    gridMajorEvery: GRID_MAJOR_EVERY,
  },
  node: {
    background: '#252530',
    border: 'rgba(255,255,255,0.08)',
    text: '#ffffff',
    subtext: '#9ca3af',
  },
  pin: PIN_COLORS,
  connection: {
    width: 1.8,
    execColor: 'rgba(255,255,255,0.6)',
    execWidth: 2,
  },
}
```

**Step 4: Update buildTheme to match new interface**

Same `merge` + `buildTheme` functions, just referencing new keys.

**Step 5: Build to verify no type errors**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 6: Commit**

```
feat(flow): update theme interface and constants for UE style
```

---

### Task 2: Rewrite background — hierarchical line grid

**Files:**
- Modify: `packages/flow/src/components/FlowCanvas.tsx` — `drawBackground` function

**Step 1: Replace drawBackground**

Replace the dot-grid background with a hierarchical line grid:

```typescript
function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, theme: FlowTheme) {
  // Solid fill
  ctx.fillStyle = theme.canvas!.background!
  ctx.fillRect(0, 0, w, h)

  const sp = theme.canvas!.gridSpacing ?? GRID_SPACING
  const majorEvery = theme.canvas!.gridMajorEvery ?? GRID_MAJOR_EVERY
  const majorSp = sp * majorEvery

  // Fine grid lines
  ctx.strokeStyle = theme.canvas!.gridColor!
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let x = sp; x < w; x += sp) {
    if (x % majorSp === 0) continue // skip major positions
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = sp; y < h; y += sp) {
    if (y % majorSp === 0) continue
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()

  // Major grid lines
  ctx.strokeStyle = theme.canvas!.gridMajorColor!
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = majorSp; x < w; x += majorSp) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let y = majorSp; y < h; y += majorSp) {
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()
}
```

**Step 2: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 3: Commit**

```
feat(flow): hierarchical line grid background (UE style)
```

---

### Task 3: Rewrite pins — triangle exec + hollow/filled states

**Files:**
- Modify: `packages/flow/src/components/FlowCanvas.tsx` — pin drawing functions + connected set logic

**Step 1: Add connected pin set builder**

Add this function after the utility section:

```typescript
function buildConnectedPins(graph: FlowGraph): Set<string> {
  const set = new Set<string>()
  for (const c of graph.connections) {
    set.add(`${c.fromNodeId}:${c.fromPinId}:out`)
    set.add(`${c.toNodeId}:${c.toPinId}:in`)
  }
  return set
}
```

**Step 2: Replace pin drawing functions**

Replace `drawDiamond` and `drawCircle` with:

```typescript
function drawExecPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, connected: boolean) {
  // Right-pointing triangle (play button arrow)
  const hw = 4.5  // half-width
  const hh = 5.5  // half-height
  ctx.beginPath()
  ctx.moveTo(cx - hw, cy - hh)
  ctx.lineTo(cx + hw + 1, cy)
  ctx.lineTo(cx - hw, cy + hh)
  ctx.closePath()
  if (connected) {
    ctx.fillStyle = color
    ctx.fill()
  } else {
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

function drawDataPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, connected: boolean) {
  ctx.beginPath()
  ctx.arc(cx, cy, PIN_R, 0, Math.PI * 2)
  if (connected) {
    ctx.fillStyle = color
    ctx.fill()
  } else {
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}
```

**Step 3: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS (pin functions unused yet, no errors)

**Step 4: Commit**

```
feat(flow): triangle exec pins + hollow/filled states
```

---

### Task 4: Rewrite node rendering — full-color header

**Files:**
- Modify: `packages/flow/src/components/FlowCanvas.tsx` — `drawNode` function

**Step 1: Rewrite drawNode**

Replace the entire `drawNode` function. Key changes:
- Full-color header at 100% opacity (not a tint)
- No accent dot, no accent bar
- Title text always white on the colored header
- Pin rendering uses new `drawExecPin`/`drawDataPin` with `connected` param
- `drawNode` now takes `connectedPins: Set<string>` param

```typescript
function drawNode(ctx: CanvasRenderingContext2D, node: FlowNode, theme: FlowTheme, connectedPins: Set<string>) {
  const x = node.position.x
  const y = node.position.y
  const w = node.width ?? NODE_W
  const h = nodeHeight(node)
  const accent = node.color ?? '#6c63ff'

  // Shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 3
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.fillStyle = theme.node!.background!
  ctx.fill()
  ctx.restore()

  // Body
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.fillStyle = theme.node!.background!
  ctx.fill()

  // Header — full color, clipped to top rounded corners
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.clip()
  ctx.fillStyle = accent
  ctx.fillRect(x, y, w, HEADER_H)
  ctx.restore()

  // Border
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, CORNER)
  ctx.strokeStyle = theme.node!.border!
  ctx.lineWidth = 1
  ctx.stroke()

  // Title — white on colored header
  ctx.fillStyle = theme.node!.text!
  ctx.font = '600 12px -apple-system, "Segoe UI", system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(node.label, x + 12, y + HEADER_H / 2)

  // Input pins
  node.inputs.forEach((pin, i) => {
    const py = y + PIN_Y0 + i * PIN_ROW
    const px = x
    const col = pinColor(pin.type, theme)
    const connected = connectedPins.has(`${node.id}:${pin.id}:in`)

    if (pin.type === 'exec') {
      drawExecPin(ctx, px, py, col, connected)
    } else {
      drawDataPin(ctx, px, py, col, connected)
    }

    if (pin.label) {
      ctx.fillStyle = theme.node!.subtext!
      ctx.font = '11px -apple-system, "Segoe UI", system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(pin.label, px + 12, py)
    }
  })

  // Output pins
  node.outputs.forEach((pin, i) => {
    const py = y + PIN_Y0 + i * PIN_ROW
    const px = x + w
    const col = pinColor(pin.type, theme)
    const connected = connectedPins.has(`${node.id}:${pin.id}:out`)

    if (pin.type === 'exec') {
      drawExecPin(ctx, px, py, col, connected)
    } else {
      drawDataPin(ctx, px, py, col, connected)
    }

    if (pin.label) {
      ctx.fillStyle = theme.node!.subtext!
      ctx.font = '11px -apple-system, "Segoe UI", system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(pin.label, px - 12, py)
    }
  })
}
```

**Step 2: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 3: Commit**

```
feat(flow): full-color header nodes with connected pin states
```

---

### Task 5: Update connections — white exec wires + type-colored data wires

**Files:**
- Modify: `packages/flow/src/components/FlowCanvas.tsx` — `drawConnections` function

**Step 1: Update drawConnections**

```typescript
function drawConnections(ctx: CanvasRenderingContext2D, model: GraphModel, theme: FlowTheme) {
  const nodes = model.getNodes()

  for (const conn of model.getConnections()) {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId)
    const toNode = nodes.find(n => n.id === conn.toNodeId)
    if (!fromNode || !toNode) continue

    const fromP = pinPos(fromNode, conn.fromPinId, true)
    const toP = pinPos(toNode, conn.toPinId, false)
    if (!fromP || !toP) continue

    const fromPin = fromNode.outputs.find(p => p.id === conn.fromPinId)
    const isExec = fromPin?.type === 'exec'

    const color = isExec
      ? (theme.connection!.execColor ?? 'rgba(255,255,255,0.6)')
      : pinColor(fromPin?.type ?? 'string', theme)
    const lw = isExec
      ? (theme.connection!.execWidth ?? 2)
      : (theme.connection!.width ?? 1.8)

    drawBezier(ctx, fromP, toP, color, lw)
  }
}
```

**Step 2: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 3: Commit**

```
feat(flow): white exec wires + type-colored data wires
```

---

### Task 6: Wire up renderCanvas + React component with connectedPins

**Files:**
- Modify: `packages/flow/src/components/FlowCanvas.tsx` — `renderCanvas` and component

**Step 1: Update renderCanvas signature**

```typescript
function renderCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  model: GraphModel,
  theme: FlowTheme,
  connectedPins: Set<string>,
) {
  drawBackground(ctx, w, h, theme)
  drawConnections(ctx, model, theme)
  for (const node of model.getNodes()) {
    drawNode(ctx, node, theme, connectedPins)
  }
}
```

**Step 2: Update useEffect in the React component**

Build `connectedPins` from `graph` and pass it to `renderCanvas`:

```typescript
const connectedPins = buildConnectedPins(graph)
// ... in paint():
renderCanvas(ctx!, rect.width, rect.height, model, theme, connectedPins)
```

**Step 3: Update pinPos to use NODE_W correctly**

`pinPos` already references `NODE_W` — just verify it's using the updated 220 value.

**Step 4: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 5: Commit**

```
feat(flow): integrate connected pin detection into render pipeline
```

---

### Task 7: Update stories for new node width + verify in Storybook

**Files:**
- Modify: `packages/flow/stories/FlowCanvas.stories.tsx`
- Modify: `packages/flow/stories/DefineNode.stories.tsx`
- Modify: `packages/flow/stories/RealWorkflow.stories.tsx`

**Step 1: Update FlowCanvas.stories.tsx CrimsonTheme**

Replace old theme keys with new ones:

```typescript
theme: {
  canvas: { background: '#0a0508', gridColor: 'rgba(255,100,100,0.02)', gridMajorColor: 'rgba(255,100,100,0.05)' },
  node: { background: '#1a0e12', border: 'rgba(255,80,80,0.08)', text: '#f0d0d8', subtext: '#8a5a6a' },
  connection: { width: 2 },
},
```

**Step 2: Adjust node positions in stories if needed**

Since NODE_W changed from 240 to 220, nodes may need repositioning to avoid overlaps. Check each story and adjust `position.x` values if nodes are too close.

**Step 3: Build to verify**

Run: `pnpm --filter @quantum-studios/flow build`
Expected: BUILD SUCCESS

**Step 4: Visual verification in Storybook**

Run: `pnpm --filter @quantum-studios/flow storybook`

Verify:
- Background shows hierarchical line grid (fine + major lines)
- Nodes have full-color headers (not tinted)
- Exec pins are triangles, white, hollow when disconnected / filled when connected
- Data pins are circles, colored by type, hollow/filled
- Exec connections are white semitransparent
- Data connections match source pin color
- Title text is white on colored header
- No visual artifacts or clipping issues

**Step 5: Commit**

```
feat(flow): update all stories for UE-style renderer
```
