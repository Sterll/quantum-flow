import React, { useMemo } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { FlowCanvas } from '../src/components/FlowCanvas'
import { GraphStore } from '../src/model/GraphStore'
import { defineNode } from '../src/define/defineNode'
import type { FlowGraph } from '../src/types'

const EventNode = defineNode({
  type: 'fivem/server/event',
  label: 'Server Event',
  color: '#6c63ff',
  inputs: [],
  outputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'source', type: 'number', label: 'Source' },
  ],
})

const CommandNode = defineNode({
  type: 'fivem/server/command',
  label: 'Register Command',
  color: '#f59e0b',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'name', type: 'string', label: 'Name' },
  ],
  outputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'args', type: 'array', label: 'Args' },
  ],
})

const PrintNode = defineNode({
  type: 'fivem/server/print',
  label: 'Print',
  color: '#22c55e',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'text', type: 'string', label: 'Text' },
  ],
  outputs: [],
})

const eventInstance = EventNode.createInstance({ x: 60, y: 100 }, { id: 'ev1' })
const cmdInstance = CommandNode.createInstance({ x: 360, y: 80 }, { id: 'cmd1' })
const printInstance = PrintNode.createInstance({ x: 660, y: 120 }, { id: 'pr1' })

const graph: FlowGraph = {
  nodes: [eventInstance, cmdInstance, printInstance],
  connections: [
    { id: 'c1', fromNodeId: 'ev1', fromPinId: 'exec', toNodeId: 'cmd1', toPinId: 'exec' },
    { id: 'c2', fromNodeId: 'cmd1', fromPinId: 'exec', toNodeId: 'pr1', toPinId: 'exec' },
    { id: 'c3', fromNodeId: 'cmd1', fromPinId: 'args', toNodeId: 'pr1', toPinId: 'text' },
  ],
}

const InteractiveCanvas = (props: { graph: FlowGraph; width?: number; height?: number }) => {
  const store = useMemo(() => {
    const s = new GraphStore()
    s.importGraph(props.graph)
    return s
  }, [])
  return <FlowCanvas store={store} width={props.width} height={props.height} />
}

const meta: Meta<typeof InteractiveCanvas> = {
  title: 'defineNode API',
  component: InteractiveCanvas,
  parameters: { layout: 'fullscreen' },
}

export default meta

export const FivemNodes: StoryObj<typeof InteractiveCanvas> = {
  args: { graph, width: 960, height: 380 },
}
