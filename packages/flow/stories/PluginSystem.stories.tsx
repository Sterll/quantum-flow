import React, { useMemo } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { FlowCanvas } from '../src/components/FlowCanvas'
import { defineNode } from '../src/define/defineNode'
import { definePlugin } from '../src/plugin/definePlugin'
import { createFlowEditor } from '../src/plugin/createFlowEditor'
import { Validator } from '../src/model/Validator'
import type { FlowGraph } from '../src/types'

/* ────────────────────────────────────────────────
   FiveM Plugin - Custom nodes & pin types
   ──────────────────────────────────────────────── */

const fivemPlugin = definePlugin({
  name: 'fivem',
  version: '1.0.0',
  pinTypes: {
    'fivem:player': { color: '#22d3ee', label: 'Player' },
    'fivem:vehicle': { color: '#f59e0b', label: 'Vehicle' },
  },
  nodes: [
    defineNode({
      type: 'fivem/onPlayerJoin',
      label: 'On Player Join',
      color: '#22d3ee',
      inputs: [],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'player', type: 'fivem:player', label: 'Player' },
        { id: 'name', type: 'string', label: 'Name' },
      ],
    }),
    defineNode({
      type: 'fivem/getVehicle',
      label: 'Get Vehicle',
      color: '#f59e0b',
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'player', type: 'fivem:player', label: 'Player' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'vehicle', type: 'fivem:vehicle', label: 'Vehicle' },
        { id: 'model', type: 'string', label: 'Model' },
      ],
    }),
    defineNode({
      type: 'fivem/teleport',
      label: 'Teleport Player',
      color: '#8b5cf6',
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'player', type: 'fivem:player', label: 'Player' },
        { id: 'x', type: 'number', label: 'X' },
        { id: 'y', type: 'number', label: 'Y' },
        { id: 'z', type: 'number', label: 'Z' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
      ],
    }),
    defineNode({
      type: 'fivem/notify',
      label: 'Notify Player',
      color: '#16a34a',
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'player', type: 'fivem:player', label: 'Player' },
        { id: 'message', type: 'string', label: 'Message' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
      ],
    }),
  ],
  rules: (V) => [V.noSelfConnection(), V.noDuplicateConnection()],
})

/* ────────────────────────────────────────────────
   Discord Plugin - Custom nodes
   ──────────────────────────────────────────────── */

const discordPlugin = definePlugin({
  name: 'discord',
  version: '1.0.0',
  nodes: [
    defineNode({
      type: 'discord/sendMessage',
      label: 'Send Message',
      color: '#5865f2',
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'channel', type: 'string', label: 'Channel' },
        { id: 'content', type: 'string', label: 'Content' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'messageId', type: 'string', label: 'Message ID' },
      ],
    }),
    defineNode({
      type: 'discord/sendEmbed',
      label: 'Send Embed',
      color: '#5865f2',
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'channel', type: 'string', label: 'Channel' },
        { id: 'title', type: 'string', label: 'Title' },
        { id: 'description', type: 'string', label: 'Description' },
        { id: 'data', type: 'object', label: 'Fields' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
      ],
    }),
  ],
})

/* ────────────────────────────────────────────────
   Demo graph using both plugins
   ──────────────────────────────────────────────── */

const demoGraph: FlowGraph = {
  nodes: [
    {
      id: 'join',
      type: 'fivem/onPlayerJoin',
      label: 'On Player Join',
      position: { x: 40, y: 80 },
      inputs: [],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'player', type: 'fivem:player', label: 'Player' },
        { id: 'name', type: 'string', label: 'Name' },
      ],
      data: {},
      color: '#22d3ee',
    },
    {
      id: 'getVeh',
      type: 'fivem/getVehicle',
      label: 'Get Vehicle',
      position: { x: 360, y: 50 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'player', type: 'fivem:player', label: 'Player' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'vehicle', type: 'fivem:vehicle', label: 'Vehicle' },
        { id: 'model', type: 'string', label: 'Model' },
      ],
      data: {},
      color: '#f59e0b',
    },
    {
      id: 'notify',
      type: 'fivem/notify',
      label: 'Notify Player',
      position: { x: 360, y: 260 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'player', type: 'fivem:player', label: 'Player' },
        { id: 'message', type: 'string', label: 'Message' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
      ],
      data: {},
      color: '#16a34a',
    },
    {
      id: 'discordMsg',
      type: 'discord/sendMessage',
      label: 'Send Message',
      position: { x: 700, y: 40 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'channel', type: 'string', label: 'Channel' },
        { id: 'content', type: 'string', label: 'Content' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'messageId', type: 'string', label: 'Message ID' },
      ],
      data: {},
      color: '#5865f2',
    },
    {
      id: 'discordEmbed',
      type: 'discord/sendEmbed',
      label: 'Send Embed',
      position: { x: 700, y: 230 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'channel', type: 'string', label: 'Channel' },
        { id: 'title', type: 'string', label: 'Title' },
        { id: 'description', type: 'string', label: 'Description' },
        { id: 'data', type: 'object', label: 'Fields' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
      ],
      data: {},
      color: '#5865f2',
    },
  ],
  connections: [
    // Exec flow
    { id: 'e1', fromNodeId: 'join', fromPinId: 'exec', toNodeId: 'getVeh', toPinId: 'exec' },
    { id: 'e2', fromNodeId: 'getVeh', fromPinId: 'exec', toNodeId: 'discordMsg', toPinId: 'exec' },
    { id: 'e3', fromNodeId: 'discordMsg', fromPinId: 'exec', toNodeId: 'discordEmbed', toPinId: 'exec' },

    // Data flow
    { id: 'd1', fromNodeId: 'join', fromPinId: 'player', toNodeId: 'getVeh', toPinId: 'player' },
    { id: 'd2', fromNodeId: 'join', fromPinId: 'player', toNodeId: 'notify', toPinId: 'player' },
    { id: 'd3', fromNodeId: 'join', fromPinId: 'name', toNodeId: 'notify', toPinId: 'message' },
    { id: 'd4', fromNodeId: 'getVeh', fromPinId: 'model', toNodeId: 'discordMsg', toPinId: 'content' },
    { id: 'd5', fromNodeId: 'join', fromPinId: 'name', toNodeId: 'discordEmbed', toPinId: 'title' },
  ],
}

/* ────────────────────────────────────────────────
   Story component
   ──────────────────────────────────────────────── */

const PluginDemo = () => {
  const editor = useMemo(() => {
    return createFlowEditor({
      plugins: [fivemPlugin, discordPlugin],
      initialGraph: demoGraph,
      history: true,
    })
  }, [])

  return (
    <FlowCanvas
      store={editor.store}
      pinTypes={editor.pinTypes}
      animateConnections
      showMinimap
      width={1100}
      height={500}
    />
  )
}

const meta: Meta<typeof PluginDemo> = {
  title: 'Plugin System',
  component: PluginDemo,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof PluginDemo>

export const FiveM_And_Discord_Plugins: Story = {}
