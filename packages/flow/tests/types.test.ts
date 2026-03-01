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
