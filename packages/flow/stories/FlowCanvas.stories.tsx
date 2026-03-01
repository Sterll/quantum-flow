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
