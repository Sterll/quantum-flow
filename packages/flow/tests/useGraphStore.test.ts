import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGraphStore } from '../src/react/useGraphStore'
import { Validator } from '../src/model/Validator'
import type { FlowGraph } from '../src/types'

describe('useGraphStore', () => {
  it('returns a GraphStore instance', () => {
    const { result } = renderHook(() => useGraphStore())
    expect(result.current).toBeDefined()
    expect(result.current.getNodes()).toEqual([])
    expect(result.current.getConnections()).toEqual([])
  })

  it('returns the same instance across re-renders', () => {
    const { result, rerender } = renderHook(() => useGraphStore())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('imports initialGraph at creation', () => {
    const graph: FlowGraph = {
      nodes: [{
        id: 'n1', type: 'test/node', label: 'Test',
        position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
      }],
      connections: [],
    }
    const { result } = renderHook(() => useGraphStore({ initialGraph: graph }))
    expect(result.current.getNodes()).toHaveLength(1)
    expect(result.current.getNode('n1')).toBeDefined()
  })

  it('applies validator when provided', () => {
    const validator = new Validator()
    validator.addRule({
      name: 'block-all',
      validate: () => ({ valid: false, reason: 'blocked' }),
    })
    const { result } = renderHook(() => useGraphStore({ validator }))
    expect(() => {
      result.current.addNode({
        id: 'n1', type: 'test/node', label: 'Test',
        position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
      })
    }).toThrow('blocked')
  })
})
