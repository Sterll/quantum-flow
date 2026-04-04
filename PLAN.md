# @quantum-studios/flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Créer une lib node editor Canvas/TypeScript headless, modulaire, avec design soigné par défaut et API `defineNode` — concurrent de React Flow.

**Architecture:** Canvas 2D HTML5 pour le rendu (zero dépendance), TypeScript strict, agnostique de framework. Séparation claire entre GraphModel (données), GraphRenderer (rendu canvas), GraphInteraction (events souris/touch). Bundlé via tsup en ESM + CJS.

**Tech Stack:** TypeScript 5, tsup, Vitest, pnpm workspaces

---

## Task 1 : Setup du package

**Files:**
- Create: `packages/flow/package.json`
- Create: `packages/flow/tsconfig.json`
- Create: `packages/flow/tsup.config.ts`
- Create: `packages/flow/vitest.config.ts`
- Create: `packages/flow/src/index.ts`

**Step 1 : Initialiser la structure du package**

```bash
mkdir -p packages/flow/src
cd packages/flow
```

**Step 2 : Créer `packages/flow/package.json`**

```json
{
  "name": "@quantum-studios/flow",
  "version": "0.1.0",
  "description": "Headless node editor for React — Canvas-based, TypeScript-first",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsup": "^8.0.0",
    "vitest": "^1.6.0",
    "@types/react": "^18",
    "react": "^18"
  }
}
```

**Step 3 : Créer `packages/flow/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
})
```

**Step 4 : Créer `packages/flow/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 5 : Créer `packages/flow/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
})
```

**Step 6 : Créer `packages/flow/src/index.ts` (barrel vide)**

```ts
export {}
```

**Step 7 : Installer les dépendances et vérifier le build**

```bash
pnpm install
pnpm --filter @quantum-studios/flow build
```
Expected: dossier `dist/` créé avec `index.js`, `index.mjs`, `index.d.ts`

**Step 7b : Vérifier que Vitest fonctionne**

```bash
pnpm --filter @quantum-studios/flow test
```
Expected: `No test files found` — c'est normal, pas encore de tests. Vitest démarre sans erreur.

**Step 7c : Vérifier le mode watch**

```bash
pnpm --filter @quantum-studios/flow test:watch
```
Expected: Vitest démarre en mode watch et attend des fichiers. Quitter avec `q`.

**Step 8 : Commit**

```bash
git add packages/flow
git commit -m "feat(flow): setup package @quantum-studios/flow"
```

---

## Task 2 : Types de base (GraphModel)

**Files:**
- Create: `packages/flow/src/types/pin.types.ts`
- Create: `packages/flow/src/types/node.types.ts`
- Create: `packages/flow/src/types/connection.types.ts`
- Create: `packages/flow/src/types/graph.types.ts`
- Create: `packages/flow/src/types/index.ts`
- Create: `packages/flow/tests/types.test.ts`

**Step 1 : Écrire les tests de types**

```ts
// packages/flow/tests/types.test.ts
import { describe, it, expect } from 'vitest'
import type { FlowNode, FlowPin, FlowConnection, FlowGraph } from '../src/types'

describe('Types', () => {
  it('FlowNode doit avoir id, type, position, inputs, outputs', () => {
    const node: FlowNode = {
      id: 'node-1',
      type: 'fivem/event',
      label: 'On Player Join',
      position: { x: 100, y: 200 },
      inputs: [],
      outputs: [],
      data: {},
    }
    expect(node.id).toBe('node-1')
  })

  it('FlowPin doit avoir id, type, label', () => {
    const pin: FlowPin = {
      id: 'pin-1',
      type: 'exec',
      label: '',
    }
    expect(pin.type).toBe('exec')
  })

  it('FlowConnection doit lier deux pins', () => {
    const conn: FlowConnection = {
      id: 'conn-1',
      fromNodeId: 'node-1',
      fromPinId: 'out-exec',
      toNodeId: 'node-2',
      toPinId: 'in-exec',
    }
    expect(conn.fromNodeId).toBe('node-1')
  })
})
```

**Step 2 : Run le test — doit échouer**

```bash
pnpm --filter @quantum-studios/flow test
```
Expected: FAIL — types introuvables

**Step 3 : Créer `packages/flow/src/types/pin.types.ts`**

```ts
export type PinType =
  | 'exec'
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | (string & {}) // custom types via namespacing

export interface FlowPin {
  id: string
  type: PinType
  label: string
  optional?: boolean
  defaultValue?: unknown
}
```

**Step 4 : Créer `packages/flow/src/types/node.types.ts`**

```ts
import type { FlowPin } from './pin.types'

export interface FlowNodePosition {
  x: number
  y: number
}

export interface FlowNode {
  id: string
  type: string // namespaced: 'fivem/event', 'minecraft/command'
  label: string
  position: FlowNodePosition
  inputs: FlowPin[]
  outputs: FlowPin[]
  data: Record<string, unknown>
  width?: number
  color?: string
}
```

**Step 5 : Créer `packages/flow/src/types/connection.types.ts`**

```ts
export interface FlowConnection {
  id: string
  fromNodeId: string
  fromPinId: string
  toNodeId: string
  toPinId: string
}
```

**Step 6 : Créer `packages/flow/src/types/graph.types.ts`**

```ts
import type { FlowNode } from './node.types'
import type { FlowConnection } from './connection.types'

export interface FlowGraph {
  nodes: FlowNode[]
  connections: FlowConnection[]
}
```

**Step 7 : Créer `packages/flow/src/types/index.ts`**

```ts
export * from './pin.types'
export * from './node.types'
export * from './connection.types'
export * from './graph.types'
```

**Step 8 : Mettre à jour `packages/flow/src/index.ts`**

```ts
export * from './types'
```

**Step 9 : Run les tests — doivent passer**

```bash
pnpm --filter @quantum-studios/flow test
```
Expected: PASS

**Step 10 : Commit**

```bash
git add packages/flow/src/types packages/flow/tests packages/flow/src/index.ts
git commit -m "feat(flow): add core TypeScript types (FlowNode, FlowPin, FlowConnection)"
```

---

## Task 3 : GraphModel — gestion des données

**Files:**
- Create: `packages/flow/src/model/GraphModel.ts`
- Create: `packages/flow/tests/GraphModel.test.ts`

**Step 1 : Écrire les tests**

```ts
// packages/flow/tests/GraphModel.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { GraphModel } from '../src/model/GraphModel'

describe('GraphModel', () => {
  let model: GraphModel

  beforeEach(() => {
    model = new GraphModel()
  })

  it('doit ajouter un node', () => {
    model.addNode({ id: 'n1', type: 'test/node', label: 'Test', position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {} })
    expect(model.getNodes()).toHaveLength(1)
  })

  it('doit supprimer un node et ses connexions', () => {
    model.addNode({ id: 'n1', type: 'test/node', label: 'A', position: { x: 0, y: 0 }, inputs: [{ id: 'in', type: 'exec', label: '' }], outputs: [], data: {} })
    model.addNode({ id: 'n2', type: 'test/node', label: 'B', position: { x: 200, y: 0 }, inputs: [], outputs: [{ id: 'out', type: 'exec', label: '' }], data: {} })
    model.addConnection({ id: 'c1', fromNodeId: 'n2', fromPinId: 'out', toNodeId: 'n1', toPinId: 'in' })
    model.removeNode('n1')
    expect(model.getNodes()).toHaveLength(1)
    expect(model.getConnections()).toHaveLength(0)
  })

  it('doit ajouter une connexion', () => {
    model.addConnection({ id: 'c1', fromNodeId: 'n1', fromPinId: 'out', toNodeId: 'n2', toPinId: 'in' })
    expect(model.getConnections()).toHaveLength(1)
  })

  it('doit déplacer un node', () => {
    model.addNode({ id: 'n1', type: 'test/node', label: 'Test', position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {} })
    model.moveNode('n1', { x: 150, y: 300 })
    expect(model.getNodes()[0].position).toEqual({ x: 150, y: 300 })
  })

  it('doit sérialiser et désérialiser le graph', () => {
    model.addNode({ id: 'n1', type: 'test/node', label: 'Test', position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {} })
    const json = model.serialize()
    const model2 = GraphModel.fromJSON(json)
    expect(model2.getNodes()).toHaveLength(1)
  })
})
```

**Step 2 : Run — doit échouer**

```bash
pnpm --filter @quantum-studios/flow test
```

**Step 3 : Créer `packages/flow/src/model/GraphModel.ts`**

```ts
import type { FlowNode, FlowConnection, FlowGraph, FlowNodePosition } from '../types'

export class GraphModel {
  private nodes: Map<string, FlowNode> = new Map()
  private connections: Map<string, FlowConnection> = new Map()

  addNode(node: FlowNode): void {
    this.nodes.set(node.id, { ...node })
  }

  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId)
    // Supprimer toutes les connexions liées à ce node
    for (const [id, conn] of this.connections) {
      if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
        this.connections.delete(id)
      }
    }
  }

  moveNode(nodeId: string, position: FlowNodePosition): void {
    const node = this.nodes.get(nodeId)
    if (node) {
      this.nodes.set(nodeId, { ...node, position })
    }
  }

  updateNodeData(nodeId: string, data: Record<string, unknown>): void {
    const node = this.nodes.get(nodeId)
    if (node) {
      this.nodes.set(nodeId, { ...node, data: { ...node.data, ...data } })
    }
  }

  addConnection(connection: FlowConnection): void {
    this.connections.set(connection.id, { ...connection })
  }

  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId)
  }

  getNodes(): FlowNode[] {
    return Array.from(this.nodes.values())
  }

  getConnections(): FlowConnection[] {
    return Array.from(this.connections.values())
  }

  getNode(id: string): FlowNode | undefined {
    return this.nodes.get(id)
  }

  serialize(): FlowGraph {
    return {
      nodes: this.getNodes(),
      connections: this.getConnections(),
    }
  }

  static fromJSON(graph: FlowGraph): GraphModel {
    const model = new GraphModel()
    for (const node of graph.nodes) model.addNode(node)
    for (const conn of graph.connections) model.addConnection(conn)
    return model
  }
}
```

**Step 4 : Exporter depuis index**

```ts
// Ajouter dans packages/flow/src/index.ts
export * from './model/GraphModel'
```

**Step 5 : Run tests — doivent passer**

```bash
pnpm --filter @quantum-studios/flow test
```
Expected: PASS (5 tests)

**Step 6 : Commit**

```bash
git add packages/flow/src/model packages/flow/tests/GraphModel.test.ts packages/flow/src/index.ts
git commit -m "feat(flow): add GraphModel with nodes, connections, serialize"
```

---

## Task 4 : defineNode API

**Files:**
- Create: `packages/flow/src/define/defineNode.ts`
- Create: `packages/flow/src/define/NodeRegistry.ts`
- Create: `packages/flow/tests/defineNode.test.ts`

**Step 1 : Écrire les tests**

```ts
// packages/flow/tests/defineNode.test.ts
import { describe, it, expect } from 'vitest'
import { defineNode, NodeRegistry } from '../src/define'

describe('defineNode', () => {
  it('doit enregistrer un node dans le registry', () => {
    const registry = new NodeRegistry()
    const MyNode = defineNode({
      type: 'test/my-node',
      label: 'My Node',
      inputs: [{ id: 'exec', type: 'exec', label: '' }],
      outputs: [{ id: 'exec', type: 'exec', label: '' }],
    })
    registry.register(MyNode)
    expect(registry.get('test/my-node')).toBeDefined()
  })

  it('doit créer une instance de FlowNode depuis une définition', () => {
    const MyNode = defineNode({
      type: 'test/my-node',
      label: 'My Node',
      inputs: [],
      outputs: [],
    })
    const instance = MyNode.createInstance({ x: 100, y: 200 })
    expect(instance.type).toBe('test/my-node')
    expect(instance.position).toEqual({ x: 100, y: 200 })
    expect(instance.id).toBeTruthy()
  })
})
```

**Step 2 : Run — doit échouer**

```bash
pnpm --filter @quantum-studios/flow test
```

**Step 3 : Créer `packages/flow/src/define/defineNode.ts`**

```ts
import type { FlowNode, FlowPin, FlowNodePosition } from '../types'

export interface NodeDefinition {
  type: string
  label: string
  color?: string
  icon?: string
  inputs: FlowPin[]
  outputs: FlowPin[]
  defaultData?: Record<string, unknown>
}

export interface NodeDefinitionWithFactory extends NodeDefinition {
  createInstance: (position: FlowNodePosition, overrides?: Partial<FlowNode>) => FlowNode
}

let _idCounter = 0
function generateId(): string {
  return `node-${Date.now()}-${++_idCounter}`
}

export function defineNode(definition: NodeDefinition): NodeDefinitionWithFactory {
  return {
    ...definition,
    createInstance(position: FlowNodePosition, overrides?: Partial<FlowNode>): FlowNode {
      return {
        id: generateId(),
        type: definition.type,
        label: definition.label,
        position,
        inputs: definition.inputs.map(p => ({ ...p })),
        outputs: definition.outputs.map(p => ({ ...p })),
        data: { ...definition.defaultData },
        color: definition.color,
        ...overrides,
      }
    },
  }
}
```

**Step 4 : Créer `packages/flow/src/define/NodeRegistry.ts`**

```ts
import type { NodeDefinitionWithFactory } from './defineNode'

export class NodeRegistry {
  private definitions: Map<string, NodeDefinitionWithFactory> = new Map()

  register(definition: NodeDefinitionWithFactory): void {
    this.definitions.set(definition.type, definition)
  }

  registerMany(definitions: NodeDefinitionWithFactory[]): void {
    for (const def of definitions) this.register(def)
  }

  get(type: string): NodeDefinitionWithFactory | undefined {
    return this.definitions.get(type)
  }

  getAll(): NodeDefinitionWithFactory[] {
    return Array.from(this.definitions.values())
  }

  getByNamespace(namespace: string): NodeDefinitionWithFactory[] {
    return this.getAll().filter(d => d.type.startsWith(`${namespace}/`))
  }
}
```

**Step 5 : Créer `packages/flow/src/define/index.ts`**

```ts
export * from './defineNode'
export * from './NodeRegistry'
```

**Step 6 : Exporter depuis index principal**

```ts
// Ajouter dans packages/flow/src/index.ts
export * from './define'
```

**Step 7 : Run tests**

```bash
pnpm --filter @quantum-studios/flow test
```
Expected: PASS

**Step 8 : Commit**

```bash
git add packages/flow/src/define packages/flow/tests/defineNode.test.ts packages/flow/src/index.ts
git commit -m "feat(flow): add defineNode API and NodeRegistry"
```

---

## Task 5 : Validation des connexions (typed pins)

**Files:**
- Create: `packages/flow/src/model/ConnectionValidator.ts`
- Create: `packages/flow/tests/ConnectionValidator.test.ts`

**Step 1 : Écrire les tests**

```ts
// packages/flow/tests/ConnectionValidator.test.ts
import { describe, it, expect } from 'vitest'
import { ConnectionValidator } from '../src/model/ConnectionValidator'

describe('ConnectionValidator', () => {
  const validator = new ConnectionValidator()

  it('exec → exec : valide', () => {
    expect(validator.canConnect('exec', 'exec')).toBe(true)
  })

  it('string → string : valide', () => {
    expect(validator.canConnect('string', 'string')).toBe(true)
  })

  it('string → number : invalide', () => {
    expect(validator.canConnect('string', 'number')).toBe(false)
  })

  it('exec → string : invalide', () => {
    expect(validator.canConnect('exec', 'string')).toBe(false)
  })

  it('object → object : valide', () => {
    expect(validator.canConnect('object', 'object')).toBe(true)
  })
})
```

**Step 2 : Run — doit échouer**

```bash
pnpm --filter @quantum-studios/flow test
```

**Step 3 : Créer `packages/flow/src/model/ConnectionValidator.ts`**

```ts
import type { PinType } from '../types'

const COMPATIBLE_TYPES: Record<string, PinType[]> = {
  exec: ['exec'],
  string: ['string'],
  number: ['number'],
  boolean: ['boolean'],
  object: ['object'],
  array: ['array'],
}

export class ConnectionValidator {
  canConnect(fromType: PinType, toType: PinType): boolean {
    const compatible = COMPATIBLE_TYPES[fromType]
    if (!compatible) {
      // Type custom : compatible uniquement avec le même type
      return fromType === toType
    }
    return compatible.includes(toType)
  }

  addCompatibility(fromType: PinType, toTypes: PinType[]): void {
    COMPATIBLE_TYPES[fromType] = [...(COMPATIBLE_TYPES[fromType] ?? []), ...toTypes]
  }
}
```

**Step 4 : Exporter**

```ts
// Ajouter dans packages/flow/src/index.ts
export * from './model/ConnectionValidator'
```

**Step 5 : Run tests**

```bash
pnpm --filter @quantum-studios/flow test
```
Expected: PASS

**Step 6 : Commit**

```bash
git add packages/flow/src/model/ConnectionValidator.ts packages/flow/tests/ConnectionValidator.test.ts packages/flow/src/index.ts
git commit -m "feat(flow): add ConnectionValidator with typed pin compatibility"
```

---

## Task 6 : Historique undo/redo

**Files:**
- Create: `packages/flow/src/model/History.ts`
- Create: `packages/flow/tests/History.test.ts`

**Step 1 : Écrire les tests**

```ts
// packages/flow/tests/History.test.ts
import { describe, it, expect } from 'vitest'
import { History } from '../src/model/History'
import { GraphModel } from '../src/model/GraphModel'

describe('History', () => {
  it('doit permettre un undo après une action', () => {
    const model = new GraphModel()
    const history = new History(model, 50)

    history.snapshot()
    model.addNode({ id: 'n1', type: 'test', label: 'Test', position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {} })
    history.snapshot()

    expect(model.getNodes()).toHaveLength(1)
    history.undo()
    expect(model.getNodes()).toHaveLength(0)
  })

  it('doit permettre un redo après un undo', () => {
    const model = new GraphModel()
    const history = new History(model, 50)

    history.snapshot()
    model.addNode({ id: 'n1', type: 'test', label: 'Test', position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {} })
    history.snapshot()
    history.undo()
    history.redo()

    expect(model.getNodes()).toHaveLength(1)
  })
})
```

**Step 2 : Run — doit échouer**

```bash
pnpm --filter @quantum-studios/flow test
```

**Step 3 : Créer `packages/flow/src/model/History.ts`**

```ts
import type { FlowGraph } from '../types'
import { GraphModel } from './GraphModel'

export class History {
  private past: FlowGraph[] = []
  private future: FlowGraph[] = []
  private maxSize: number

  constructor(private model: GraphModel, maxSize = 50) {
    this.maxSize = maxSize
  }

  snapshot(): void {
    this.past.push(this.model.serialize())
    if (this.past.length > this.maxSize) {
      this.past.shift()
    }
    this.future = []
  }

  undo(): void {
    if (this.past.length < 2) return
    const current = this.past.pop()!
    this.future.unshift(current)
    const previous = this.past[this.past.length - 1]
    this.restore(previous)
  }

  redo(): void {
    if (this.future.length === 0) return
    const next = this.future.shift()!
    this.past.push(next)
    this.restore(next)
  }

  canUndo(): boolean {
    return this.past.length > 1
  }

  canRedo(): boolean {
    return this.future.length > 0
  }

  private restore(graph: FlowGraph): void {
    const restored = GraphModel.fromJSON(graph)
    // Réinitialiser le model en place
    const nodes = this.model.getNodes()
    nodes.forEach(n => this.model.removeNode(n.id))
    restored.getNodes().forEach(n => this.model.addNode(n))
    restored.getConnections().forEach(c => this.model.addConnection(c))
  }
}
```

**Step 4 : Exporter**

```ts
// Ajouter dans packages/flow/src/index.ts
export * from './model/History'
```

**Step 5 : Run tests**

```bash
pnpm --filter @quantum-studios/flow test
```
Expected: PASS

**Step 6 : Commit**

```bash
git add packages/flow/src/model/History.ts packages/flow/tests/History.test.ts packages/flow/src/index.ts
git commit -m "feat(flow): add undo/redo History"
```

---

## Task 7 : Composant React FlowCanvas (wrapper Canvas)

**Files:**
- Create: `packages/flow/src/components/FlowCanvas.tsx`
- Create: `packages/flow/src/components/index.ts`

**Step 1 : Créer `packages/flow/src/components/FlowCanvas.tsx`**

```tsx
import React, { useRef, useEffect, useCallback } from 'react'
import type { FlowGraph } from '../types'
import type { NodeDefinitionWithFactory } from '../define'
import { GraphModel } from '../model/GraphModel'
import { ConnectionValidator } from '../model/ConnectionValidator'
import { History } from '../model/History'

export interface FlowTheme {
  canvas?: {
    background?: string
    grid?: string
  }
  node?: {
    background?: string
    border?: string
    header?: string
    text?: string
  }
  pin?: {
    exec?: string
    string?: string
    number?: string
    boolean?: string
    object?: string
    [key: string]: string | undefined
  }
  connection?: {
    color?: string
    width?: number
  }
}

export interface FlowCanvasProps {
  graph: FlowGraph
  nodeDefinitions?: NodeDefinitionWithFactory[]
  theme?: FlowTheme
  onGraphChange?: (graph: FlowGraph) => void
  onConnect?: (fromNodeId: string, fromPinId: string, toNodeId: string, toPinId: string) => void
  onNodeMove?: (nodeId: string, x: number, y: number) => void
  readOnly?: boolean
  width?: number | string
  height?: number | string
}

const DEFAULT_THEME: FlowTheme = {
  canvas: { background: '#0f0f1a', grid: '#1a1a2e' },
  node: { background: '#1a1a2e', border: '#2a2a4e', header: '#16213e', text: '#e2e8f0' },
  pin: { exec: '#ffffff', string: '#ff6b6b', number: '#ffd93d', boolean: '#6bcb77', object: '#4d96ff' },
  connection: { color: '#6c63ff', width: 2 },
}

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  graph,
  theme,
  onGraphChange,
  readOnly = false,
  width = '100%',
  height = '600px',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<GraphModel>(GraphModel.fromJSON(graph))
  const historyRef = useRef<History>(new History(modelRef.current))
  const validatorRef = useRef<ConnectionValidator>(new ConnectionValidator())

  const mergedTheme: FlowTheme = {
    canvas: { ...DEFAULT_THEME.canvas, ...theme?.canvas },
    node: { ...DEFAULT_THEME.node, ...theme?.node },
    pin: { ...DEFAULT_THEME.pin, ...theme?.pin },
    connection: { ...DEFAULT_THEME.connection, ...theme?.connection },
  }

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = mergedTheme.canvas!.background!
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grid
    ctx.strokeStyle = mergedTheme.canvas!.grid!
    ctx.lineWidth = 1
    const gridSize = 20
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
    }

    // Nodes
    const nodes = modelRef.current.getNodes()
    for (const node of nodes) {
      const w = node.width ?? 200
      const h = 30 + Math.max(node.inputs.length, node.outputs.length) * 22 + 10

      // Header
      ctx.fillStyle = node.color ?? mergedTheme.node!.header!
      ctx.beginPath()
      ctx.roundRect(node.position.x, node.position.y, w, 30, [6, 6, 0, 0])
      ctx.fill()

      // Body
      ctx.fillStyle = mergedTheme.node!.background!
      ctx.strokeStyle = mergedTheme.node!.border!
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(node.position.x, node.position.y, w, h, 6)
      ctx.fill()
      ctx.stroke()

      // Label
      ctx.fillStyle = mergedTheme.node!.text!
      ctx.font = '600 12px system-ui'
      ctx.fillText(node.label, node.position.x + 10, node.position.y + 20)
    }
  }, [mergedTheme])

  useEffect(() => {
    render()
  }, [render])

  return (
    <canvas
      ref={canvasRef}
      width={typeof width === 'number' ? width : 800}
      height={typeof height === 'number' ? height : 600}
      style={{ width, height, display: 'block' }}
    />
  )
}
```

**Step 2 : Créer `packages/flow/src/components/index.ts`**

```ts
export * from './FlowCanvas'
```

**Step 3 : Exporter depuis index principal**

```ts
// Ajouter dans packages/flow/src/index.ts
export * from './components'
```

**Step 4 : Build pour vérifier pas d'erreur TypeScript**

```bash
pnpm --filter @quantum-studios/flow build
```
Expected: build réussi, pas d'erreur TS

**Step 5 : Commit**

```bash
git add packages/flow/src/components packages/flow/src/index.ts
git commit -m "feat(flow): add FlowCanvas React component with basic canvas renderer"
```

---

## Task 8 : Build final + export barrel complet

**Files:**
- Modify: `packages/flow/src/index.ts`

**Step 1 : Vérifier que tout est exporté**

```ts
// packages/flow/src/index.ts — doit contenir :
export * from './types'
export * from './model/GraphModel'
export * from './model/ConnectionValidator'
export * from './model/History'
export * from './define'
export * from './components'
```

**Step 2 : Build final**

```bash
pnpm --filter @quantum-studios/flow build
```
Expected: dist/ avec index.js, index.mjs, index.d.ts

**Step 3 : Run tous les tests**

```bash
pnpm --filter @quantum-studios/flow test
```
Expected: tous les tests PASS

**Step 4 : Commit final**

```bash
git add packages/flow/src/index.ts
git commit -m "feat(flow): v0.1.0 — @quantum-studios/flow ready for integration"
```

---

## Task 9 : Setup Storybook

**Files:**
- Create: `packages/flow/.storybook/main.ts`
- Create: `packages/flow/.storybook/preview.ts`
- Create: `packages/flow/stories/FlowCanvas.stories.tsx`
- Create: `packages/flow/stories/DefineNode.stories.tsx`

**Step 1 : Installer Storybook**

```bash
pnpm --filter @quantum-studios/flow dlx storybook@latest init --type react
```
Expected: Storybook initialisé avec les fichiers de config de base

**Step 2 : Mettre à jour `packages/flow/.storybook/main.ts`**

```ts
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-controls',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
}

export default config
```

**Step 3 : Créer `packages/flow/.storybook/preview.ts`**

```ts
import type { Preview } from '@storybook/react'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f0f1a' },
        { name: 'light', value: '#f8fafc' },
      ],
    },
  },
}

export default preview
```

**Step 4 : Créer `packages/flow/stories/FlowCanvas.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { FlowCanvas } from '../src/components/FlowCanvas'
import type { FlowGraph } from '../src/types'

const sampleGraph: FlowGraph = {
  nodes: [
    {
      id: 'n1',
      type: 'fivem/server/event',
      label: 'On Player Join',
      position: { x: 80, y: 100 },
      inputs: [],
      outputs: [{ id: 'exec', type: 'exec', label: '' }],
      data: { eventName: 'playerConnecting' },
      color: '#6c63ff',
    },
    {
      id: 'n2',
      type: 'fivem/server/notify',
      label: 'Send Notification',
      position: { x: 350, y: 100 },
      inputs: [{ id: 'exec', type: 'exec', label: '' }, { id: 'msg', type: 'string', label: 'Message' }],
      outputs: [{ id: 'exec', type: 'exec', label: '' }],
      data: { message: 'Welcome!' },
      color: '#22c55e',
    },
  ],
  connections: [
    { id: 'c1', fromNodeId: 'n1', fromPinId: 'exec', toNodeId: 'n2', toPinId: 'exec' },
  ],
}

const meta: Meta<typeof FlowCanvas> = {
  title: 'FlowCanvas',
  component: FlowCanvas,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof FlowCanvas>

export const Default: Story = {
  args: {
    graph: sampleGraph,
    width: 800,
    height: 500,
  },
}

export const CustomTheme: Story = {
  args: {
    graph: sampleGraph,
    width: 800,
    height: 500,
    theme: {
      canvas: { background: '#0a0a0f', grid: '#111122' },
      node: { background: '#111122', border: '#ff6b6b', header: '#1a0a0a', text: '#fff' },
      connection: { color: '#ff6b6b', width: 3 },
    },
  },
}

export const EmptyGraph: Story = {
  args: {
    graph: { nodes: [], connections: [] },
    width: 800,
    height: 500,
  },
}
```

**Step 5 : Créer `packages/flow/stories/DefineNode.stories.tsx`**

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { FlowCanvas } from '../src/components/FlowCanvas'
import { defineNode } from '../src/define/defineNode'

// Exemple de nodes créés via defineNode
const EventNode = defineNode({
  type: 'fivem/server/event',
  label: 'Server Event',
  color: '#6c63ff',
  inputs: [],
  outputs: [{ id: 'exec', type: 'exec', label: '' }],
})

const CommandNode = defineNode({
  type: 'fivem/server/command',
  label: 'Register Command',
  color: '#f59e0b',
  inputs: [{ id: 'exec', type: 'exec', label: '' }],
  outputs: [{ id: 'exec', type: 'exec', label: '' }, { id: 'args', type: 'array', label: 'Args' }],
})

const graph = {
  nodes: [
    EventNode.createInstance({ x: 80, y: 120 }),
    CommandNode.createInstance({ x: 350, y: 120 }),
  ],
  connections: [],
}

const meta: Meta<typeof FlowCanvas> = {
  title: 'defineNode API',
  component: FlowCanvas,
  parameters: { layout: 'fullscreen' },
}

export default meta

export const FivemNodes: StoryObj<typeof FlowCanvas> = {
  args: { graph, width: 800, height: 500 },
}
```

**Step 6 : Ajouter le script Storybook dans `package.json`**

```json
// Ajouter dans packages/flow/package.json scripts :
"storybook": "storybook dev -p 6006",
"build-storybook": "storybook build"
```

**Step 7 : Lancer Storybook et vérifier**

```bash
pnpm --filter @quantum-studios/flow storybook
```
Expected: http://localhost:6006 affiche les stories FlowCanvas et DefineNode

**Step 8 : Commit**

```bash
git add packages/flow/.storybook packages/flow/stories packages/flow/package.json
git commit -m "feat(flow): add Storybook with FlowCanvas and defineNode stories"
```
