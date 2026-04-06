# Changelog

All notable changes to `@quantum-studios/flow` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-04-06

### Added

**Model Layer**
- `GraphStore` - single source of truth for nodes and connections with batch operations
- `EventBus` - typed pub/sub system for graph mutations
- `Validator` - composable validation pipeline with 6 built-in rules
- `HistoryManager` - undo/redo engine with batch-aware snapshots

**Define Layer**
- `defineNode()` - node blueprint factory with pin validation and UUID generation
- `NodeRegistry` - catalog for registered node definitions with namespace support

**Interaction Hooks**
- `useViewport` - pan, zoom, fit-to-content, coordinate conversion
- `useNodeDrag` - drag-and-drop with snap support and batch moves
- `useConnection` - connection creation by dragging between pins
- `useSelection` - click, shift-click, and rubber-band selection
- `useHotkeys` - keyboard shortcuts (delete, undo, redo, select all, copy, paste, group)
- `useCanvasInteraction` - orchestrator composing all interaction hooks

**React API**
- `useFlowEditor` - all-in-one hook composing store, history, clipboard, and registry
- `useGraphStore` - reactive store subscription with automatic re-renders
- `useHistory` - React wrapper around HistoryManager
- `useClipboard` - copy/cut/paste for nodes and connections
- `FlowProvider` / `useFlowContext` - React context for the editor API

**Components**
- `FlowCanvas` - Canvas 2D renderer with grid, nodes, connections, selection, and alignment guides
- `Minimap` - minimap overlay with viewport indicator and click-to-navigate
- `FlowContextMenu` - right-click context menu for canvas actions
- `SearchPalette` - Ctrl+K fuzzy search overlay for adding nodes

**Features**
- Node groups/frames with drag-to-move children
- Reroute waypoints on connections (double-click to add, drag to move)
- Export canvas as PNG image
- Connection animation (flowing dashes on exec wires)
- Touch/mobile support for all interactions
- Deep clone protection on node data
- Centralized layout constants

**Testing**
- 140+ tests across 17 test files
- Vitest with jsdom environment
