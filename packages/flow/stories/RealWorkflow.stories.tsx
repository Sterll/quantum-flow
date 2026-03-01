import type { Meta, StoryObj } from '@storybook/react'
import { FlowCanvas } from '../src/components/FlowCanvas'
import type { FlowGraph } from '../src/types'

/* ────────────────────────────────────────────────
   Player Report Moderation System
   A realistic FiveM server-side workflow
   ──────────────────────────────────────────────── */

const moderationGraph: FlowGraph = {
  nodes: [
    {
      id: 'trigger',
      type: 'event/onReport',
      label: 'On Player Report',
      position: { x: 40, y: 60 },
      inputs: [],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'reporter', type: 'object', label: 'Reporter' },
        { id: 'target', type: 'object', label: 'Target' },
        { id: 'reason', type: 'string', label: 'Reason' },
      ],
      data: {},
      color: '#8b5cf6',
    },
    {
      id: 'db',
      type: 'database/query',
      label: 'Fetch Player History',
      position: { x: 340, y: 30 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'playerId', type: 'object', label: 'Player' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'error', type: 'exec', label: 'Error' },
        { id: 'data', type: 'object', label: 'Data' },
        { id: 'warnings', type: 'number', label: 'Warnings' },
      ],
      data: {},
      color: '#0891b2',
    },
    {
      id: 'condition',
      type: 'logic/compare',
      label: 'Repeat Offender?',
      position: { x: 640, y: 40 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'value', type: 'number', label: 'Value' },
        { id: 'threshold', type: 'number', label: 'Threshold' },
      ],
      outputs: [
        { id: 'true', type: 'exec', label: 'True' },
        { id: 'false', type: 'exec', label: 'False' },
      ],
      data: {},
      color: '#d97706',
    },
    {
      id: 'ban',
      type: 'action/ban',
      label: 'Ban Player',
      position: { x: 940, y: 20 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'target', type: 'object', label: 'Target' },
        { id: 'reason', type: 'string', label: 'Reason' },
        { id: 'duration', type: 'number', label: 'Duration' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
      ],
      data: {},
      color: '#dc2626',
    },
    {
      id: 'discord',
      type: 'integration/discord',
      label: 'Send to Discord',
      position: { x: 1240, y: 30 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'channel', type: 'string', label: 'Channel' },
        { id: 'message', type: 'string', label: 'Message' },
        { id: 'embed', type: 'object', label: 'Embed' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
      ],
      data: {},
      color: '#5865f2',
    },
    {
      id: 'ticket',
      type: 'action/createTicket',
      label: 'Create Ticket',
      position: { x: 940, y: 240 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'title', type: 'string', label: 'Title' },
        { id: 'reporter', type: 'object', label: 'Reporter' },
        { id: 'target', type: 'object', label: 'Target' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'ticketId', type: 'string', label: 'Ticket ID' },
      ],
      data: {},
      color: '#2563eb',
    },
    {
      id: 'notify',
      type: 'action/notify',
      label: 'Notify Admins',
      position: { x: 1240, y: 220 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'message', type: 'string', label: 'Message' },
        { id: 'priority', type: 'number', label: 'Priority' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
      ],
      data: {},
      color: '#16a34a',
    },
    {
      id: 'log',
      type: 'debug/log',
      label: 'Log Event',
      position: { x: 640, y: 310 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'text', type: 'string', label: 'Text' },
        { id: 'level', type: 'string', label: 'Level' },
      ],
      outputs: [],
      data: {},
      color: '#ea580c',
    },
    {
      id: 'format',
      type: 'util/format',
      label: 'Format Message',
      position: { x: 340, y: 280 },
      inputs: [
        { id: 'template', type: 'string', label: 'Template' },
        { id: 'playerName', type: 'string', label: 'Player Name' },
        { id: 'count', type: 'number', label: 'Count' },
      ],
      outputs: [
        { id: 'result', type: 'string', label: 'Result' },
      ],
      data: {},
      color: '#737373',
    },
  ],
  connections: [
    // Main exec flow
    { id: 'c1', fromNodeId: 'trigger', fromPinId: 'exec', toNodeId: 'db', toPinId: 'exec' },
    { id: 'c2', fromNodeId: 'db', fromPinId: 'exec', toNodeId: 'condition', toPinId: 'exec' },
    { id: 'c3', fromNodeId: 'condition', fromPinId: 'true', toNodeId: 'ban', toPinId: 'exec' },
    { id: 'c4', fromNodeId: 'condition', fromPinId: 'false', toNodeId: 'ticket', toPinId: 'exec' },
    { id: 'c5', fromNodeId: 'ban', fromPinId: 'exec', toNodeId: 'discord', toPinId: 'exec' },
    { id: 'c6', fromNodeId: 'ticket', fromPinId: 'exec', toNodeId: 'notify', toPinId: 'exec' },
    { id: 'c7', fromNodeId: 'db', fromPinId: 'error', toNodeId: 'log', toPinId: 'exec' },

    // Data flow
    { id: 'd1', fromNodeId: 'trigger', fromPinId: 'target', toNodeId: 'db', toPinId: 'playerId' },
    { id: 'd2', fromNodeId: 'db', fromPinId: 'warnings', toNodeId: 'condition', toPinId: 'value' },
    { id: 'd3', fromNodeId: 'trigger', fromPinId: 'target', toNodeId: 'ban', toPinId: 'target' },
    { id: 'd4', fromNodeId: 'trigger', fromPinId: 'reason', toNodeId: 'ban', toPinId: 'reason' },
    { id: 'd5', fromNodeId: 'trigger', fromPinId: 'reason', toNodeId: 'ticket', toPinId: 'title' },
    { id: 'd6', fromNodeId: 'trigger', fromPinId: 'reporter', toNodeId: 'ticket', toPinId: 'reporter' },
    { id: 'd7', fromNodeId: 'trigger', fromPinId: 'target', toNodeId: 'ticket', toPinId: 'target' },
    { id: 'd8', fromNodeId: 'ticket', fromPinId: 'ticketId', toNodeId: 'notify', toPinId: 'message' },
    { id: 'd9', fromNodeId: 'trigger', fromPinId: 'reason', toNodeId: 'log', toPinId: 'text' },
    { id: 'd10', fromNodeId: 'db', fromPinId: 'data', toNodeId: 'discord', toPinId: 'embed' },
    { id: 'd11', fromNodeId: 'trigger', fromPinId: 'reason', toNodeId: 'format', toPinId: 'template' },
    { id: 'd12', fromNodeId: 'db', fromPinId: 'warnings', toNodeId: 'format', toPinId: 'count' },
    { id: 'd13', fromNodeId: 'format', fromPinId: 'result', toNodeId: 'discord', toPinId: 'message' },
  ],
}

/* ────────────────────────────────────────────────
   CRON Database Sync Workflow
   ──────────────────────────────────────────────── */

const cronGraph: FlowGraph = {
  nodes: [
    {
      id: 'cron',
      type: 'trigger/cron',
      label: 'CRON Trigger',
      position: { x: 40, y: 120 },
      inputs: [],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
      ],
      data: {},
      color: '#16a34a',
    },
    {
      id: 'query',
      type: 'database/query',
      label: 'Database Query',
      position: { x: 300, y: 60 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'sql', type: 'string', label: 'Query' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'error', type: 'exec', label: 'Error' },
        { id: 'rows', type: 'array', label: 'Rows' },
        { id: 'count', type: 'number', label: 'Row Count' },
      ],
      data: {},
      color: '#0891b2',
    },
    {
      id: 'check',
      type: 'logic/condition',
      label: 'Has Results?',
      position: { x: 600, y: 30 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'value', type: 'number', label: 'Value' },
      ],
      outputs: [
        { id: 'true', type: 'exec', label: 'Yes' },
        { id: 'false', type: 'exec', label: 'No' },
      ],
      data: {},
      color: '#d97706',
    },
    {
      id: 'loop',
      type: 'control/loop',
      label: 'For Each Row',
      position: { x: 880, y: 20 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'items', type: 'array', label: 'Items' },
      ],
      outputs: [
        { id: 'each', type: 'exec', label: 'Each' },
        { id: 'done', type: 'exec', label: 'Done' },
        { id: 'item', type: 'object', label: 'Item' },
        { id: 'index', type: 'number', label: 'Index' },
      ],
      data: {},
      color: '#0891b2',
    },
    {
      id: 'transform',
      type: 'data/transform',
      label: 'Transform Data',
      position: { x: 1180, y: 10 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'input', type: 'object', label: 'Input' },
        { id: 'mapping', type: 'string', label: 'Mapping' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'output', type: 'object', label: 'Output' },
      ],
      data: {},
      color: '#7c3aed',
    },
    {
      id: 'api',
      type: 'http/request',
      label: 'API Call',
      position: { x: 1180, y: 180 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'url', type: 'string', label: 'URL' },
        { id: 'body', type: 'object', label: 'Body' },
        { id: 'method', type: 'string', label: 'Method' },
      ],
      outputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'error', type: 'exec', label: 'Error' },
        { id: 'response', type: 'object', label: 'Response' },
        { id: 'status', type: 'number', label: 'Status' },
      ],
      data: {},
      color: '#ea580c',
    },
    {
      id: 'logOk',
      type: 'debug/log',
      label: 'Log Success',
      position: { x: 880, y: 260 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'text', type: 'string', label: 'Text' },
      ],
      outputs: [],
      data: {},
      color: '#16a34a',
    },
    {
      id: 'logEmpty',
      type: 'debug/log',
      label: 'Log Empty',
      position: { x: 600, y: 240 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'text', type: 'string', label: 'Text' },
      ],
      outputs: [],
      data: {},
      color: '#737373',
    },
    {
      id: 'logErr',
      type: 'debug/log',
      label: 'Log Error',
      position: { x: 300, y: 280 },
      inputs: [
        { id: 'exec', type: 'exec', label: '' },
        { id: 'text', type: 'string', label: 'Text' },
      ],
      outputs: [],
      data: {},
      color: '#dc2626',
    },
  ],
  connections: [
    // Main flow
    { id: 'e1', fromNodeId: 'cron', fromPinId: 'exec', toNodeId: 'query', toPinId: 'exec' },
    { id: 'e2', fromNodeId: 'query', fromPinId: 'exec', toNodeId: 'check', toPinId: 'exec' },
    { id: 'e3', fromNodeId: 'check', fromPinId: 'true', toNodeId: 'loop', toPinId: 'exec' },
    { id: 'e4', fromNodeId: 'loop', fromPinId: 'each', toNodeId: 'transform', toPinId: 'exec' },
    { id: 'e5', fromNodeId: 'transform', fromPinId: 'exec', toNodeId: 'api', toPinId: 'exec' },
    { id: 'e6', fromNodeId: 'loop', fromPinId: 'done', toNodeId: 'logOk', toPinId: 'exec' },
    { id: 'e7', fromNodeId: 'check', fromPinId: 'false', toNodeId: 'logEmpty', toPinId: 'exec' },
    { id: 'e8', fromNodeId: 'query', fromPinId: 'error', toNodeId: 'logErr', toPinId: 'exec' },

    // Data
    { id: 'f1', fromNodeId: 'query', fromPinId: 'count', toNodeId: 'check', toPinId: 'value' },
    { id: 'f2', fromNodeId: 'query', fromPinId: 'rows', toNodeId: 'loop', toPinId: 'items' },
    { id: 'f3', fromNodeId: 'loop', fromPinId: 'item', toNodeId: 'transform', toPinId: 'input' },
    { id: 'f4', fromNodeId: 'transform', fromPinId: 'output', toNodeId: 'api', toPinId: 'body' },
  ],
}

const meta: Meta<typeof FlowCanvas> = {
  title: 'Real Workflows',
  component: FlowCanvas,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof FlowCanvas>

export const ModerationSystem: Story = {
  args: {
    graph: moderationGraph,
    width: 1540,
    height: 480,
  },
}

export const CronDatabaseSync: Story = {
  args: {
    graph: cronGraph,
    width: 1500,
    height: 420,
  },
}
