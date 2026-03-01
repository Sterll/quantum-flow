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
