import { describe, it, expect } from 'vitest'
import { Validator } from '../src/model/Validator'
import type { FlowGraph, FlowConnection, FlowNode } from '../src/types'

const makeNode = (id: string, inputs: Array<{ id: string; type: string }> = [], outputs: Array<{ id: string; type: string }> = []): FlowNode => ({
  id,
  type: 'test/node',
  label: id,
  position: { x: 0, y: 0 },
  inputs: inputs.map(p => ({ ...p, label: p.id })),
  outputs: outputs.map(p => ({ ...p, label: p.id })),
  data: {},
})

const makeConn = (id: string, from: string, fromPin: string, to: string, toPin: string): FlowConnection => ({
  id, fromNodeId: from, fromPinId: fromPin, toNodeId: to, toPinId: toPin,
})

describe('Validator', () => {
  describe('typeCompatibility', () => {
    it('allows same types (string -> string)', () => {
      const v = new Validator([Validator.typeCompatibility()])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'string' }]),
          makeNode('n2', [{ id: 'in', type: 'string' }], []),
        ],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n2', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(true)
    })

    it('rejects incompatible types (string -> number)', () => {
      const v = new Validator([Validator.typeCompatibility()])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'string' }]),
          makeNode('n2', [{ id: 'in', type: 'number' }], []),
        ],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n2', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
    })

    it('supports custom overrides (string -> number allowed)', () => {
      const v = new Validator([Validator.typeCompatibility({ string: ['string', 'number'] })])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'string' }]),
          makeNode('n2', [{ id: 'in', type: 'number' }], []),
        ],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n2', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(true)
    })
  })

  describe('noSelfConnection', () => {
    it('rejects connection from a node to itself', () => {
      const v = new Validator([Validator.noSelfConnection()])
      const graph: FlowGraph = {
        nodes: [makeNode('n1', [{ id: 'in', type: 'string' }], [{ id: 'out', type: 'string' }])],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n1', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
    })
  })

  describe('noDuplicateConnection', () => {
    it('rejects duplicate connection between same pins', () => {
      const v = new Validator([Validator.noDuplicateConnection()])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'exec' }]),
          makeNode('n2', [{ id: 'in', type: 'exec' }], []),
        ],
        connections: [makeConn('c1', 'n1', 'out', 'n2', 'in')],
      }
      const conn = makeConn('c2', 'n1', 'out', 'n2', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
    })
  })

  describe('noDuplicateNodeId', () => {
    it('rejects node with existing ID', () => {
      const v = new Validator([Validator.noDuplicateNodeId()])
      const graph: FlowGraph = {
        nodes: [makeNode('n1')],
        connections: [],
      }
      const node = makeNode('n1')
      const result = v.validate({ graph, action: 'addNode', payload: node })
      expect(result.valid).toBe(false)
    })
  })

  describe('noCycles', () => {
    it('rejects connection that would create a cycle', () => {
      const v = new Validator([Validator.noCycles()])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [{ id: 'in', type: 'exec' }], [{ id: 'out', type: 'exec' }]),
          makeNode('n2', [{ id: 'in', type: 'exec' }], [{ id: 'out', type: 'exec' }]),
          makeNode('n3', [{ id: 'in', type: 'exec' }], [{ id: 'out', type: 'exec' }]),
        ],
        connections: [
          makeConn('c1', 'n1', 'out', 'n2', 'in'),
          makeConn('c2', 'n2', 'out', 'n3', 'in'),
        ],
      }
      const conn = makeConn('c3', 'n3', 'out', 'n1', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
    })

    it('allows connection that does not create a cycle', () => {
      const v = new Validator([Validator.noCycles()])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'exec' }]),
          makeNode('n2', [{ id: 'in', type: 'exec' }], [{ id: 'out', type: 'exec' }]),
          makeNode('n3', [{ id: 'in', type: 'exec' }], []),
        ],
        connections: [makeConn('c1', 'n1', 'out', 'n2', 'in')],
      }
      const conn = makeConn('c2', 'n2', 'out', 'n3', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(true)
    })
  })

  describe('maxConnectionsPerPin', () => {
    it('rejects when pin exceeds max connections', () => {
      const v = new Validator([Validator.maxConnectionsPerPin(1)])
      const graph: FlowGraph = {
        nodes: [
          makeNode('n1', [], [{ id: 'out', type: 'string' }]),
          makeNode('n2', [{ id: 'in', type: 'string' }], []),
          makeNode('n3', [{ id: 'in', type: 'string' }], []),
        ],
        connections: [makeConn('c1', 'n1', 'out', 'n2', 'in')],
      }
      const conn = makeConn('c2', 'n1', 'out', 'n3', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
    })
  })

  describe('pipeline', () => {
    it('runs all rules and returns first failure', () => {
      const v = new Validator([
        Validator.noSelfConnection(),
        Validator.typeCompatibility(),
      ])
      const graph: FlowGraph = {
        nodes: [makeNode('n1', [{ id: 'in', type: 'string' }], [{ id: 'out', type: 'string' }])],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n1', 'in')
      const result = v.validate({ graph, action: 'addConnection', payload: conn })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toContain('self')
    })

    it('addRule/removeRule modifies the pipeline', () => {
      const v = new Validator()
      const graph: FlowGraph = {
        nodes: [makeNode('n1', [{ id: 'in', type: 'string' }], [{ id: 'out', type: 'string' }])],
        connections: [],
      }
      const conn = makeConn('c1', 'n1', 'out', 'n1', 'in')
      expect(v.validate({ graph, action: 'addConnection', payload: conn }).valid).toBe(true)
      v.addRule(Validator.noSelfConnection())
      expect(v.validate({ graph, action: 'addConnection', payload: conn }).valid).toBe(false)
      v.removeRule('noSelfConnection')
      expect(v.validate({ graph, action: 'addConnection', payload: conn }).valid).toBe(true)
    })
  })
})
