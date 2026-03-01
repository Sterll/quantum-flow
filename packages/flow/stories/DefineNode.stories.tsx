import type { Meta, StoryObj } from '@storybook/react'
import { FlowCanvas } from '../src/components/FlowCanvas'
import { defineNode } from '../src/define/defineNode'

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
