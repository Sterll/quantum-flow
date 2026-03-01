# Model v2 — Event-Driven Immutable Architecture

## Context

The current model layer (GraphModel, ConnectionValidator, History) works but has design flaws:
- ConnectionValidator uses module-level mutable state shared across all instances
- History requires manual `snapshot()` call to capture initial state
- GraphModel has no event system — consumers cannot react to changes
- No cycle detection, no self-connection prevention, no duplicate checks
- Query helpers missing (getConnectionsForNode, getConnectionsForPin)

## User Choices

- **Approach**: Full v2 rewrite (not incremental refactor)
- **Event system**: Type-safe EventBus with on/off/emit/once
- **Cycles**: Block cycles — graph must remain a DAG
- **Validator**: Pipeline of composable rules with all built-in rules
- **History**: Auto-subscribe to events, transactions via batch, labels

## Architecture

```
GraphStore (central)
    ├── uses EventBus (emit events on every mutation)
    ├── uses Validator (validate before every mutation)
    └── observed by HistoryManager (auto-capture snapshots)
```

`GraphStore` is the core. Each mutation creates a new immutable state, validates via `Validator`, and emits an event via `EventBus`. `HistoryManager` listens to events and stores snapshots automatically.

Types (`FlowGraph`, `FlowNode`, `FlowPin`, `FlowConnection`) do NOT change. Only the model classes change.

## Files

- Create: `packages/flow/src/model/EventBus.ts`
- Replace: `packages/flow/src/model/GraphStore.ts` (was GraphModel.ts)
- Replace: `packages/flow/src/model/Validator.ts` (was ConnectionValidator.ts)
- Replace: `packages/flow/src/model/HistoryManager.ts` (was History.ts)
- Modify: `packages/flow/src/define/defineNode.ts` (UUID, validation, category)
- Modify: `packages/flow/src/define/NodeRegistry.ts` (unregister, has, getCategories)
- Modify: `packages/flow/src/components/FlowCanvas.tsx` (use GraphStore)
- Modify: `packages/flow/src/index.ts` (update exports)

## EventBus

```typescript
interface GraphEvents {
  'node:added':       { node: FlowNode }
  'node:removed':     { nodeId: string; removedConnections: string[] }
  'node:moved':       { nodeId: string; position: FlowNodePosition }
  'node:dataChanged': { nodeId: string; data: Record<string, unknown> }
  'connection:added':   { connection: FlowConnection }
  'connection:removed': { connectionId: string }
  'graph:cleared':   {}
  'graph:imported':  { graph: FlowGraph }
  'batch:start':     {}
  'batch:end':       { events: Array<{ type: string; payload: unknown }> }
}

class EventBus<Events extends Record<string, unknown>> {
  on<K>(event: K, handler: (payload: Events[K]) => void): () => void  // returns unsubscribe
  off<K>(event: K, handler: Function): void
  emit<K>(event: K, payload: Events[K]): void
  once<K>(event: K, handler: (payload: Events[K]) => void): () => void
}
```

## GraphStore

Replaces `GraphModel`. Immutable state — each mutation creates a new state and emits an event.

```typescript
class GraphStore {
  constructor(options?: { validator?: Validator; eventBus?: EventBus })

  // Read (no mutation)
  getState(): FlowGraph
  getNode(id: string): FlowNode | undefined
  getNodes(): FlowNode[]
  getConnections(): FlowConnection[]
  getConnectionsForNode(nodeId: string): FlowConnection[]
  getConnectionsForPin(nodeId: string, pinId: string): FlowConnection[]
  hasConnection(fromNodeId, fromPinId, toNodeId, toPinId): boolean

  // Mutations (validate via Validator, emit via EventBus, throw on invalid)
  addNode(node: FlowNode): void
  removeNode(nodeId: string): void
  moveNode(nodeId: string, position: FlowNodePosition): void
  updateNodeData(nodeId: string, data: Record<string, unknown>): void
  addConnection(connection: FlowConnection): void
  removeConnection(connectionId: string): void

  // Batch (group operations for 1 event / 1 undo)
  batch(fn: () => void): void

  // Graph-level
  clear(): void
  importGraph(graph: FlowGraph): void
  clone(): GraphStore

  // Events
  readonly events: EventBus<GraphEvents>
}
```

## Validator

Pipeline of composable validation rules. Replaces `ConnectionValidator`.

```typescript
interface ValidationRule {
  name: string
  validate(context: ValidationContext): ValidationResult
}

interface ValidationContext {
  graph: FlowGraph
  action: 'addConnection' | 'addNode' | 'removeNode' | 'removeConnection'
  payload: FlowConnection | FlowNode | { connectionId: string } | { nodeId: string }
}

type ValidationResult = { valid: true } | { valid: false; reason: string }

class Validator {
  constructor(rules?: ValidationRule[])
  addRule(rule: ValidationRule): void
  removeRule(name: string): void
  validate(context: ValidationContext): ValidationResult

  // Built-in rule factories
  static typeCompatibility(overrides?: Record<string, string[]>): ValidationRule
  static noSelfConnection(): ValidationRule
  static noDuplicateConnection(): ValidationRule
  static noCycles(): ValidationRule           // DFS-based DAG enforcement
  static noDuplicateNodeId(): ValidationRule
  static maxConnectionsPerPin(max: number): ValidationRule
}
```

Static defaults + instance overrides for type compatibility. Each rule is independent and testable.

## HistoryManager

Replaces `History`. Auto-subscribes to GraphStore events.

```typescript
class HistoryManager {
  constructor(store: GraphStore, options?: { maxSize?: number })

  undo(): boolean
  redo(): boolean
  canUndo(): boolean
  canRedo(): boolean
  clear(): void

  getUndoStack(): Array<{ label: string; timestamp: number }>
  getRedoStack(): Array<{ label: string; timestamp: number }>
}
```

- Auto-captures initial state on first event (no manual snapshot needed)
- Batch operations = 1 undo snapshot
- Labels auto-generated from event type ("Added node 'On Player Join'", etc.)
- maxSize defaults to 50

## defineNode Improvements

- `crypto.randomUUID()` for collision-safe ID generation
- Runtime validation: reject duplicate pin IDs on same node
- New optional `category` field on `NodeDefinition`

## NodeRegistry Improvements

- `unregister(type)`: remove a definition
- `has(type)`: check existence
- `getCategories()`: returns `Map<string, NodeDefinitionWithFactory[]>` grouped by namespace

## Tests Target

From 17 to ~45+ tests:

| Module | Count |
|--------|-------|
| EventBus | 6 |
| GraphStore | 12 |
| Validator | 10 |
| HistoryManager | 8 |
| defineNode | 4 |
| NodeRegistry | 5 |
| **Total** | **~45** |

TDD strict: test first, code second.
