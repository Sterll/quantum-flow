import type { FlowGraph, FlowConnection, FlowNode } from '../types'

export interface ValidationRule {
  name: string
  validate(context: ValidationContext): ValidationResult
}

export interface ValidationContext {
  graph: FlowGraph
  action: 'addConnection' | 'addNode' | 'removeNode' | 'removeConnection'
  payload: FlowConnection | FlowNode | { connectionId: string } | { nodeId: string }
}

export type ValidationResult = { valid: true } | { valid: false; reason: string }

const DEFAULT_COMPAT: Record<string, string[]> = {
  exec: ['exec'],
  string: ['string'],
  number: ['number'],
  boolean: ['boolean'],
  object: ['object'],
  array: ['array'],
}

export class Validator {
  private rules: ValidationRule[] = []

  constructor(rules?: ValidationRule[]) {
    if (rules) this.rules = [...rules]
  }

  addRule(rule: ValidationRule): void {
    this.rules.push(rule)
  }

  removeRule(name: string): void {
    this.rules = this.rules.filter(r => r.name !== name)
  }

  validate(context: ValidationContext): ValidationResult {
    for (const rule of this.rules) {
      const result = rule.validate(context)
      if (!result.valid) return result
    }
    return { valid: true }
  }

  static typeCompatibility(overrides?: Record<string, string[]>): ValidationRule {
    const compat = overrides ?? DEFAULT_COMPAT
    return {
      name: 'typeCompatibility',
      validate(ctx) {
        if (ctx.action !== 'addConnection') return { valid: true }
        const conn = ctx.payload as FlowConnection
        const fromNode = ctx.graph.nodes.find(n => n.id === conn.fromNodeId)
        const toNode = ctx.graph.nodes.find(n => n.id === conn.toNodeId)
        if (!fromNode || !toNode) return { valid: false, reason: 'Node not found' }
        const fromPin = fromNode.outputs.find(p => p.id === conn.fromPinId)
        const toPin = toNode.inputs.find(p => p.id === conn.toPinId)
        if (!fromPin || !toPin) return { valid: false, reason: 'Pin not found' }
        const allowed = compat[fromPin.type]
        if (allowed) {
          if (!allowed.includes(toPin.type)) {
            return { valid: false, reason: `Type incompatible: ${fromPin.type} -> ${toPin.type}` }
          }
        } else if (fromPin.type !== toPin.type) {
          return { valid: false, reason: `Type incompatible: ${fromPin.type} -> ${toPin.type}` }
        }
        return { valid: true }
      },
    }
  }

  static noSelfConnection(): ValidationRule {
    return {
      name: 'noSelfConnection',
      validate(ctx) {
        if (ctx.action !== 'addConnection') return { valid: true }
        const conn = ctx.payload as FlowConnection
        if (conn.fromNodeId === conn.toNodeId) {
          return { valid: false, reason: 'Cannot connect a node to itself' }
        }
        return { valid: true }
      },
    }
  }

  static noDuplicateConnection(): ValidationRule {
    return {
      name: 'noDuplicateConnection',
      validate(ctx) {
        if (ctx.action !== 'addConnection') return { valid: true }
        const conn = ctx.payload as FlowConnection
        const exists = ctx.graph.connections.some(
          c => c.fromNodeId === conn.fromNodeId && c.fromPinId === conn.fromPinId
            && c.toNodeId === conn.toNodeId && c.toPinId === conn.toPinId,
        )
        if (exists) return { valid: false, reason: 'Duplicate connection' }
        return { valid: true }
      },
    }
  }

  static noDuplicateNodeId(): ValidationRule {
    return {
      name: 'noDuplicateNodeId',
      validate(ctx) {
        if (ctx.action !== 'addNode') return { valid: true }
        const node = ctx.payload as FlowNode
        if (ctx.graph.nodes.some(n => n.id === node.id)) {
          return { valid: false, reason: `Duplicate node ID: ${node.id}` }
        }
        return { valid: true }
      },
    }
  }

  static noCycles(): ValidationRule {
    return {
      name: 'noCycles',
      validate(ctx) {
        if (ctx.action !== 'addConnection') return { valid: true }
        const conn = ctx.payload as FlowConnection
        const adj = new Map<string, string[]>()
        for (const c of ctx.graph.connections) {
          if (!adj.has(c.fromNodeId)) adj.set(c.fromNodeId, [])
          adj.get(c.fromNodeId)!.push(c.toNodeId)
        }
        if (!adj.has(conn.fromNodeId)) adj.set(conn.fromNodeId, [])
        adj.get(conn.fromNodeId)!.push(conn.toNodeId)
        const visited = new Set<string>()
        const stack = [conn.toNodeId]
        while (stack.length > 0) {
          const current = stack.pop()!
          if (current === conn.fromNodeId) {
            return { valid: false, reason: 'Connection would create a cycle' }
          }
          if (visited.has(current)) continue
          visited.add(current)
          const neighbors = adj.get(current)
          if (neighbors) {
            for (const n of neighbors) stack.push(n)
          }
        }
        return { valid: true }
      },
    }
  }

  static maxConnectionsPerPin(max: number): ValidationRule {
    return {
      name: 'maxConnectionsPerPin',
      validate(ctx) {
        if (ctx.action !== 'addConnection') return { valid: true }
        const conn = ctx.payload as FlowConnection
        const fromCount = ctx.graph.connections.filter(
          c => c.fromNodeId === conn.fromNodeId && c.fromPinId === conn.fromPinId,
        ).length
        if (fromCount >= max) {
          return { valid: false, reason: `Pin ${conn.fromPinId} already has ${max} connection(s)` }
        }
        const toCount = ctx.graph.connections.filter(
          c => c.toNodeId === conn.toNodeId && c.toPinId === conn.toPinId,
        ).length
        if (toCount >= max) {
          return { valid: false, reason: `Pin ${conn.toPinId} already has ${max} connection(s)` }
        }
        return { valid: true }
      },
    }
  }
}
