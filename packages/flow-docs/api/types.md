# Types Reference

Complete reference for all exported TypeScript types in `@quantum-studios/flow`.

## FlowNode {#flownode}

Represents a single node in the graph.

```typescript
interface FlowNode {
  id: string
  type: string
  label: string
  position: FlowNodePosition
  inputs: FlowPin[]
  outputs: FlowPin[]
  data: Record<string, unknown>
  width?: number
  color?: string
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier (typically a UUID) |
| `type` | `string` | Yes | Node type key (e.g. `'math/add'`). Used for registry lookups. |
| `label` | `string` | Yes | Display name rendered in the node title bar |
| `position` | `FlowNodePosition` | Yes | Canvas coordinates `{ x, y }` |
| `inputs` | `FlowPin[]` | Yes | Array of input pin definitions |
| `outputs` | `FlowPin[]` | Yes | Array of output pin definitions |
| `data` | `Record<string, unknown>` | Yes | Arbitrary key-value data attached to the node |
| `width` | `number` | No | Override the node width in pixels |
| `color` | `string` | No | Accent color (hex string) displayed on the title bar |

---

## FlowNodePosition {#flownodeposition}

Canvas coordinates for a node.

```typescript
interface FlowNodePosition {
  x: number
  y: number
}
```

| Field | Type | Description |
|-------|------|-------------|
| `x` | `number` | Horizontal position in canvas space (pixels) |
| `y` | `number` | Vertical position in canvas space (pixels) |

---

## FlowPin {#flowpin}

Defines a single input or output pin on a node.

```typescript
interface FlowPin {
  id: string
  type: PinType
  label: string
  optional?: boolean
  defaultValue?: unknown
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier within the node's inputs or outputs |
| `type` | `PinType` | Yes | The data type this pin carries |
| `label` | `string` | Yes | Display label rendered next to the pin |
| `optional` | `boolean` | No | Whether the pin can be left unconnected. Default: `false`. |
| `defaultValue` | `unknown` | No | Default value when no connection is present |

---

## PinType {#pintype}

The data type a pin carries. Includes 6 built-in types plus support for custom string types.

```typescript
type PinType = 'exec' | 'string' | 'number' | 'boolean' | 'object' | 'array' | (string & {})
```

### Built-in Types

| Type | Description | Pin Shape |
|------|-------------|-----------|
| `'exec'` | Execution flow (no data) | Diamond |
| `'string'` | String value | Circle |
| `'number'` | Numeric value | Circle |
| `'boolean'` | Boolean value | Circle |
| `'object'` | Object / Record | Circle |
| `'array'` | Array | Circle |

### Custom Types

The `(string & {})` part of the union allows any string as a custom pin type while preserving autocompletion for the built-in types:

```typescript
const pin: FlowPin = {
  id: 'texture',
  type: 'texture',  // Custom type -- valid
  label: 'Texture',
}
```

Custom pin types use the default gray color (`#6b7280`) unless overridden in the `FlowTheme.pin` configuration.

---

## FlowConnection {#flowconnection}

Represents a wire connecting an output pin of one node to an input pin of another.

```typescript
interface FlowConnection {
  id: string
  fromNodeId: string
  fromPinId: string
  toNodeId: string
  toPinId: string
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique connection identifier |
| `fromNodeId` | `string` | ID of the source node |
| `fromPinId` | `string` | ID of the output pin on the source node |
| `toNodeId` | `string` | ID of the target node |
| `toPinId` | `string` | ID of the input pin on the target node |

---

## FlowGraph {#flowgraph}

The complete serializable state of a graph. This is what `GraphStore.getState()` returns and what `GraphStore.importGraph()` accepts.

```typescript
interface FlowGraph {
  nodes: FlowNode[]
  connections: FlowConnection[]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `nodes` | `FlowNode[]` | All nodes in the graph |
| `connections` | `FlowConnection[]` | All connections between nodes |

### Example

```typescript
const graph: FlowGraph = {
  nodes: [
    {
      id: 'node-1',
      type: 'math/add',
      label: 'Add',
      position: { x: 100, y: 200 },
      inputs: [
        { id: 'a', type: 'number', label: 'A' },
        { id: 'b', type: 'number', label: 'B' },
      ],
      outputs: [
        { id: 'result', type: 'number', label: 'Result' },
      ],
      data: {},
    },
  ],
  connections: [],
}
```

---

## FlowTheme {#flowtheme}

Visual customization for `FlowCanvas`. All fields are optional -- unset values fall back to the built-in dark theme.

```typescript
interface FlowTheme {
  canvas?: {
    background?: string
    gridColor?: string
  }
  node?: {
    titleBar?: string
    body?: string
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
    opacity?: number
  }
  selection?: {
    color?: string
  }
}
```

### `canvas`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `background` | `string` | `'#0a0a0a'` | Canvas background color |
| `gridColor` | `string` | `'rgba(255,255,255,0.03)'` | Grid line color |

### `node`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `titleBar` | `string` | `'#141416'` | Title bar background color |
| `body` | `string` | `'#101012'` | Node body background color |
| `border` | `string` | `'rgba(255,255,255,0.04)'` | Node border color |
| `text` | `string` | `'#bbb'` | Title text color |
| `subtext` | `string` | `'#888'` | Secondary text color (pin type labels) |

### `pin`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `exec` | `string` | `'#ffffff'` | Color for exec pins |
| `string` | `string` | `'#f472b6'` | Color for string pins |
| `number` | `string` | `'#34d399'` | Color for number pins |
| `boolean` | `string` | `'#fb923c'` | Color for boolean pins |
| `object` | `string` | `'#60a5fa'` | Color for object pins |
| `array` | `string` | `'#c084fc'` | Color for array pins |
| `[key: string]` | `string \| undefined` | `'#6b7280'` | Color for custom pin types |

### `connection`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `width` | `number` | `2` | Wire stroke width in pixels |
| `opacity` | `number` | `0.7` | Wire opacity (0 to 1) |

### `selection`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `color` | `string` | `'#60a5fa'` | Selection highlight / glow color |

---

## NodeDefinition {#nodedefinition}

Blueprint for defining a reusable node type. Passed to `defineNode()`.

```typescript
interface NodeDefinition {
  type: string
  label: string
  color?: string
  icon?: string
  category?: string
  inputs: FlowPin[]
  outputs: FlowPin[]
  defaultData?: Record<string, unknown>
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Unique type identifier (e.g. `'math/add'`). The part before `/` is the namespace. |
| `label` | `string` | Yes | Display name for the node |
| `color` | `string` | No | Accent color (hex) |
| `icon` | `string` | No | Icon identifier (for custom renderers) |
| `category` | `string` | No | Category string for organizing in palettes |
| `inputs` | `FlowPin[]` | Yes | Input pin definitions |
| `outputs` | `FlowPin[]` | Yes | Output pin definitions |
| `defaultData` | `Record<string, unknown>` | No | Default values for `FlowNode.data` when creating instances |

---

## NodeDefinitionWithFactory {#nodedefinitionwithfactory}

The return type of `defineNode()`. Extends `NodeDefinition` with a factory method for creating node instances.

```typescript
interface NodeDefinitionWithFactory extends NodeDefinition {
  createInstance(position: FlowNodePosition, overrides?: Partial<FlowNode>): FlowNode
}
```

| Member | Type | Description |
|--------|------|-------------|
| _...all `NodeDefinition` fields_ | | Inherited from the original definition |
| `createInstance` | `(position: FlowNodePosition, overrides?: Partial<FlowNode>) => FlowNode` | Create a `FlowNode` with a unique UUID, the definition's type/label/pins/data, and the given position. Optional `overrides` are shallow-merged. |

### Example

```typescript
import { defineNode } from '@quantum-studios/flow'

const AddNode = defineNode({
  type: 'math/add',
  label: 'Add',
  inputs: [
    { id: 'a', type: 'number', label: 'A' },
    { id: 'b', type: 'number', label: 'B' },
  ],
  outputs: [{ id: 'result', type: 'number', label: 'Result' }],
})

const node = AddNode.createInstance({ x: 100, y: 200 })
```

---

## ValidationRule {#validationrule}

Interface for custom validation rules used by `Validator`.

```typescript
interface ValidationRule {
  name: string
  validate(context: ValidationContext): ValidationResult
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Unique name for the rule (used in `removeRule()`) |
| `validate` | `(context: ValidationContext) => ValidationResult` | Validation function called before each mutation |

---

## ValidationContext {#validationcontext}

Context passed to every validation rule.

```typescript
interface ValidationContext {
  graph: FlowGraph
  action: 'addConnection' | 'addNode' | 'removeNode' | 'removeConnection'
  payload: FlowConnection | FlowNode | { connectionId: string } | { nodeId: string }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `graph` | `FlowGraph` | The current graph state **before** the mutation |
| `action` | `string` | The mutation being attempted |
| `payload` | `FlowConnection \| FlowNode \| { connectionId: string } \| { nodeId: string }` | The data associated with the mutation |

### Payload by Action

| Action | Payload Type |
|--------|-------------|
| `'addNode'` | `FlowNode` |
| `'addConnection'` | `FlowConnection` |
| `'removeNode'` | `{ nodeId: string }` |
| `'removeConnection'` | `{ connectionId: string }` |

---

## ValidationResult {#validationresult}

Return type from a validation rule.

```typescript
type ValidationResult = { valid: true } | { valid: false; reason: string }
```

| Outcome | Fields | Description |
|---------|--------|-------------|
| Pass | `{ valid: true }` | The mutation is allowed |
| Fail | `{ valid: false, reason: string }` | The mutation is blocked. `reason` is used in the thrown `Error` message. |

---

## GraphEvents {#graphevents}

Event map used by `EventBus<GraphEvents>` inside `GraphStore`.

```typescript
interface GraphEvents {
  'node:added': { node: FlowNode }
  'node:removed': { nodeId: string; removedConnections: string[] }
  'node:moved': { nodeId: string; position: FlowNodePosition }
  'node:dataChanged': { nodeId: string; data: Record<string, unknown> }
  'connection:added': { connection: FlowConnection }
  'connection:removed': { connectionId: string }
  'graph:cleared': {}
  'graph:imported': { graph: FlowGraph }
  'batch:start': {}
  'batch:end': { events: Array<{ type: string; payload: unknown }> }
}
```

| Event | Payload | Fires When |
|-------|---------|------------|
| `node:added` | `{ node: FlowNode }` | A node is added to the graph |
| `node:removed` | `{ nodeId: string; removedConnections: string[] }` | A node is removed (includes auto-removed connection IDs) |
| `node:moved` | `{ nodeId: string; position: FlowNodePosition }` | A node changes position |
| `node:dataChanged` | `{ nodeId: string; data: Record<string, unknown> }` | A node's data is updated |
| `connection:added` | `{ connection: FlowConnection }` | A connection is created |
| `connection:removed` | `{ connectionId: string }` | A connection is removed |
| `graph:cleared` | `{}` | All nodes and connections are removed |
| `graph:imported` | `{ graph: FlowGraph }` | A full graph is imported, replacing the previous state |
| `batch:start` | `{}` | A batch operation begins |
| `batch:end` | `{ events: Array<{ type: string; payload: unknown }> }` | A batch operation ends (includes all events emitted during the batch) |
