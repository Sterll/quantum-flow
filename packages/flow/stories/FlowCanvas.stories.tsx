import type { Meta, StoryObj } from '@storybook/react'
import { FlowCanvas } from '../src/components/FlowCanvas'
import type { FlowGraph } from '../src/types'

const sampleGraph: FlowGraph = {
  nodes: [
    {
      id: 'n1',
      type: 'event/playerJoin',
      label: 'On Player Join',
      position: { x: 60, y: 80 },
      inputs: [],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'player', type: 'object', label: 'Player' },
        { id: 'name', type: 'string', label: 'Name' },
      ],
      data: {},
      color: '#6c63ff',
    },
    {
      id: 'n2',
      type: 'logic/branch',
      label: 'Branch',
      position: { x: 360, y: 40 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'condition', type: 'boolean', label: 'Condition' },
      ],
      outputs: [
        { id: 'true', type: 'exec', label: 'True' },
        { id: 'false', type: 'exec', label: 'False' },
      ],
      data: {},
      color: '#f59e0b',
    },
    {
      id: 'n3',
      type: 'action/notify',
      label: 'Send Notification',
      position: { x: 660, y: 40 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'message', type: 'string', label: 'Message' },
        { id: 'target', type: 'object', label: 'Target' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
      ],
      data: {},
      color: '#22c55e',
    },
    {
      id: 'n4',
      type: 'action/log',
      label: 'Console Log',
      position: { x: 660, y: 260 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'text', type: 'string', label: 'Text' },
        { id: 'level', type: 'number', label: 'Level' },
      ],
      outputs: [],
      data: {},
      color: '#ef4444',
    },
  ],
  connections: [
    { id: 'c1', fromNodeId: 'n1', fromPinId: 'exec', toNodeId: 'n2', toPinId: 'exec' },
    { id: 'c2', fromNodeId: 'n2', fromPinId: 'true', toNodeId: 'n3', toPinId: 'exec' },
    { id: 'c3', fromNodeId: 'n2', fromPinId: 'false', toNodeId: 'n4', toPinId: 'exec' },
    { id: 'c4', fromNodeId: 'n1', fromPinId: 'name', toNodeId: 'n3', toPinId: 'message' },
    { id: 'c5', fromNodeId: 'n1', fromPinId: 'player', toNodeId: 'n3', toPinId: 'target' },
    { id: 'c6', fromNodeId: 'n1', fromPinId: 'name', toNodeId: 'n4', toPinId: 'text' },
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
    width: 960,
    height: 460,
  },
}

export const CrimsonTheme: Story = {
  args: {
    graph: sampleGraph,
    width: 960,
    height: 460,
    theme: {
      canvas: { background: '#0a0508', dotColor: 'rgba(255,100,100,0.03)' },
      node: { background: '#1a0e12', border: 'rgba(255,80,80,0.08)', text: '#f0d0d8', subtext: '#8a5a6a' },
      connection: { width: 2 },
    },
  },
}

export const EmptyGraph: Story = {
  args: {
    graph: { nodes: [], connections: [] },
    width: 960,
    height: 460,
  },
}
