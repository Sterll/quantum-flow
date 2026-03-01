# FlowCanvas UE-Style Renderer Design

## Context

The current FlowCanvas renderer looks too flat and "childish". The goal is to match the professional look of Unreal Engine 5's Blueprint editor — dark, clean, color-coded, with distinct pin shapes and states.

## User Choices

- **Pin states**: Hollow when disconnected, filled when connected (UE style)
- **Headers**: Full-color header bar at 100% opacity (UE style)
- **Connections**: Bezier curves colored by data type, white for exec
- **Background**: Hierarchical grid (fine + major lines)
- **Approach**: UE Faithful — no glassmorphism, no glow, no animations

## Design Specification

### Background

- Base color: `#1a1a1a`
- Fine grid: lines `rgba(255,255,255,0.03)`, spacing 20px
- Major grid: lines `rgba(255,255,255,0.07)`, every 8 steps (160px), lineWidth 1px

### Nodes

| Property | Value |
|----------|-------|
| Body background | `#252530` |
| Body border | `rgba(255,255,255,0.08)`, 1px |
| Border radius | 6px |
| Header | Node color at 100% opacity, 32px height |
| Header text | `#ffffff`, `600 12px system-ui` |
| Shadow | `rgba(0,0,0,0.5)`, blur 12px, offsetY 3px |
| Width | 220px |
| Pin row height | 24px |
| Pin area Y start | header (32px) + 14px padding = 46px |
| Bottom padding | 14px |

### Pins — Exec

- Shape: right-pointing triangle (play button arrow)
- Color: `#ffffff`
- Size: ~8px wide, ~6px tall
- **Hollow** (outline 1.5px stroke, no fill) when disconnected
- **Filled** when connected

### Pins — Data

- Shape: circle, radius 4px
- Colors per type:
  - `string`: `#f472b6` (pink)
  - `number`: `#34d399` (green)
  - `boolean`: `#fb923c` (orange)
  - `object`: `#60a5fa` (blue)
  - `array`: `#c084fc` (purple)
  - `exec`: `#ffffff` (white)
  - fallback: `#6b7280` (gray)
- **Hollow** (outline 1.5px stroke) when disconnected
- **Filled** when connected

### Connections

- Cubic bezier with proportional control point offset (`max(dx * 0.4, 60)`)
- Exec wires: `#ffffff` at 0.6 opacity, 2px width
- Data wires: same color as source pin type, 1.8px width
- `lineCap: round`

### Typography

- Node title: `600 12px -apple-system, "Segoe UI", system-ui, sans-serif`, white
- Pin labels: `11px -apple-system, "Segoe UI", system-ui, sans-serif`, `#9ca3af`

### Connected Pin Detection

To determine if a pin is connected (filled vs hollow), the renderer must:
1. Build a `Set<string>` of all connected pin keys (`nodeId:pinId:side`)
2. Check each pin against this set during rendering

## Files to Modify

- `packages/flow/src/components/FlowCanvas.tsx` — complete rewrite of rendering functions
- `packages/flow/stories/RealWorkflow.stories.tsx` — may need width adjustments for narrower nodes
- `packages/flow/stories/FlowCanvas.stories.tsx` — update theme to match new defaults
- `packages/flow/stories/DefineNode.stories.tsx` — update theme to match new defaults
