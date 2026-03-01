import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { FlowProvider, useFlowContext } from '../src/react/FlowProvider'
import type { FlowGraph } from '../src/types'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FlowProvider>{children}</FlowProvider>
)

describe('FlowProvider + useFlowContext', () => {
  it('provides FlowEditorAPI via context', () => {
    const { result } = renderHook(() => useFlowContext(), { wrapper })
    expect(result.current.store).toBeDefined()
    expect(result.current.store.getNodes()).toEqual([])
  })

  it('throws when useFlowContext is used outside FlowProvider', () => {
    expect(() => {
      renderHook(() => useFlowContext())
    }).toThrow('useFlowContext must be used within a FlowProvider')
  })

  it('passes options to useFlowEditor', () => {
    const graph: FlowGraph = {
      nodes: [{
        id: 'n1', type: 'test/node', label: 'Test',
        position: { x: 0, y: 0 }, inputs: [], outputs: [], data: {},
      }],
      connections: [],
    }
    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <FlowProvider initialGraph={graph}>{children}</FlowProvider>
    )
    const { result } = renderHook(() => useFlowContext(), { wrapper: customWrapper })
    expect(result.current.getNodes()).toHaveLength(1)
  })

  it('exposes undo/redo from context', () => {
    const { result } = renderHook(() => useFlowContext(), { wrapper })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    expect(typeof result.current.undo).toBe('function')
    expect(typeof result.current.redo).toBe('function')
  })

  it('exposes clipboard from context', () => {
    const { result } = renderHook(() => useFlowContext(), { wrapper })
    expect(result.current.canPaste).toBe(false)
    expect(typeof result.current.copy).toBe('function')
    expect(typeof result.current.cut).toBe('function')
    expect(typeof result.current.paste).toBe('function')
  })

  it('returns same reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useFlowContext(), { wrapper })
    const first = result.current.store
    rerender()
    expect(result.current.store).toBe(first)
  })
})
