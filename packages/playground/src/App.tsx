import React, { useMemo, useState, useCallback, useRef } from 'react'
import {
  FlowCanvas,
  FlowContextMenu,
  FlowContextMenuItem,
  FlowContextMenuSeparator,
  GraphStore,
  Validator,
  defineNode,
  NodeRegistry,
  createGroup,
} from '@quantum-studios/flow'
import type { FlowGraph, ContextMenuEvent, SearchPaletteItem, ExportImageOptions } from '@quantum-studios/flow'

/* ── Node definitions ── */

const EventNode = defineNode({
  type: 'event/playerJoin',
  label: 'On Player Join',
  color: '#8b5cf6',
  category: 'Events',
  inputs: [],
  outputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'player', type: 'object', label: 'Player' },
    { id: 'name', type: 'string', label: 'Name' },
  ],
})

const BranchNode = defineNode({
  type: 'logic/branch',
  label: 'Branch',
  color: '#f59e0b',
  category: 'Logic',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'condition', type: 'boolean', label: 'Condition' },
  ],
  outputs: [
    { id: 'true', type: 'exec', label: 'True' },
    { id: 'false', type: 'exec', label: 'False' },
  ],
})

const NotifyNode = defineNode({
  type: 'action/notify',
  label: 'Send Notification',
  color: '#22c55e',
  category: 'Actions',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'message', type: 'string', label: 'Message' },
    { id: 'target', type: 'object', label: 'Target' },
  ],
  outputs: [{ id: 'exec', type: 'exec', label: '' }],
})

const LogNode = defineNode({
  type: 'action/log',
  label: 'Console Log',
  color: '#ef4444',
  category: 'Actions',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'text', type: 'string', label: 'Text' },
    { id: 'level', type: 'number', label: 'Level' },
  ],
  outputs: [],
})

const DbQueryNode = defineNode({
  type: 'database/query',
  label: 'Database Query',
  color: '#0891b2',
  category: 'Database',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'query', type: 'string', label: 'Query' },
  ],
  outputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'error', type: 'exec', label: 'Error' },
    { id: 'rows', type: 'array', label: 'Rows' },
    { id: 'count', type: 'number', label: 'Count' },
  ],
})

const FormatNode = defineNode({
  type: 'util/format',
  label: 'Format String',
  color: '#737373',
  category: 'Utils',
  inputs: [
    { id: 'template', type: 'string', label: 'Template' },
    { id: 'value', type: 'string', label: 'Value' },
  ],
  outputs: [
    { id: 'result', type: 'string', label: 'Result' },
  ],
})

const DiscordNode = defineNode({
  type: 'integration/discord',
  label: 'Send to Discord',
  color: '#5865f2',
  category: 'Integrations',
  inputs: [
    { id: 'exec', type: 'exec', label: '' },
    { id: 'channel', type: 'string', label: 'Channel' },
    { id: 'message', type: 'string', label: 'Message' },
  ],
  outputs: [{ id: 'exec', type: 'exec', label: '' }],
})

const allNodeDefs = [EventNode, BranchNode, NotifyNode, LogNode, DbQueryNode, FormatNode, DiscordNode]

/* ── Initial graph ── */

const initialGraph: FlowGraph = {
  nodes: [
    EventNode.createInstance({ x: 60, y: 100 }, { id: 'n1' }),
    BranchNode.createInstance({ x: 380, y: 60 }, { id: 'n2' }),
    NotifyNode.createInstance({ x: 700, y: 40 }, { id: 'n3' }),
    LogNode.createInstance({ x: 700, y: 280 }, { id: 'n4' }),
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

/* ── Toolbar ── */

function Toolbar({
  store,
  registry,
  onFitView,
  showMinimap,
  onToggleMinimap,
  snapToAlignment,
  onToggleAlignment,
  animateConnections,
  onToggleAnimation,
  onExportPNG,
}: {
  store: GraphStore
  registry: NodeRegistry
  onFitView: () => void
  showMinimap: boolean
  onToggleMinimap: () => void
  snapToAlignment: boolean
  onToggleAlignment: () => void
  animateConnections: boolean
  onToggleAnimation: () => void
  onExportPNG: () => void
}) {
  const [nodeCount, setNodeCount] = useState(initialGraph.nodes.length)
  const [connCount, setConnCount] = useState(initialGraph.connections.length)

  useMemo(() => {
    const update = () => {
      setNodeCount(store.getNodes().length)
      setConnCount(store.getConnections().length)
    }
    store.events.on('node:added', update)
    store.events.on('node:removed', update)
    store.events.on('connection:added', update)
    store.events.on('connection:removed', update)
    store.events.on('graph:imported', update)
    store.events.on('batch:end', update)
  }, [store])

  const addNode = useCallback((type: string) => {
    const def = registry.get(type)
    if (!def) return
    const node = def.createInstance({ x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 })
    store.addNode(node)
  }, [store, registry])

  const clearGraph = useCallback(() => {
    store.clear()
  }, [store])

  const exportJSON = useCallback(() => {
    const json = JSON.stringify(store.getState(), null, 2)
    navigator.clipboard.writeText(json)
    alert('Graph JSON copied to clipboard!')
  }, [store])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      background: '#0d0d0f',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: 700, fontSize: 14, color: '#8b5cf6', marginRight: 8 }}>
        Quantum Flow
      </span>
      <span style={{ fontSize: 11, color: '#555', marginRight: 16 }}>
        Playground
      </span>

      <div style={{ display: 'flex', gap: 4 }}>
        {allNodeDefs.map(def => (
          <button
            key={def.type}
            onClick={() => addNode(def.type)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${def.color ?? '#333'}33`,
              borderRadius: 6,
              color: '#ccc',
              padding: '4px 10px',
              fontSize: 11,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${def.color ?? '#333'}22`
              e.currentTarget.style.borderColor = `${def.color ?? '#333'}66`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.borderColor = `${def.color ?? '#333'}33`
            }}
          >
            <span style={{ color: def.color, marginRight: 4 }}>+</span>
            {def.label}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)', margin: '0 4px' }} />

      {/* Feature buttons */}
      <button onClick={onFitView} style={toolBtn} title="Zoom to fit all nodes">
        Fit View
      </button>

      <button
        onClick={onToggleMinimap}
        style={{ ...toolBtn, ...(showMinimap ? toggleOn : {}) }}
        title="Toggle minimap"
      >
        Minimap
      </button>

      <button
        onClick={onToggleAlignment}
        style={{ ...toolBtn, ...(snapToAlignment ? toggleOn : {}) }}
        title="Toggle snap-to-alignment guides"
      >
        Snap Guides
      </button>

      <button
        onClick={onToggleAnimation}
        style={{ ...toolBtn, ...(animateConnections ? toggleOn : {}) }}
        title="Animate exec connections"
      >
        Animate
      </button>

      <button onClick={onExportPNG} style={toolBtn} title="Export canvas as PNG">
        Export PNG
      </button>

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: 11, color: '#666', marginRight: 8 }}>
        {nodeCount} nodes - {connCount} connections
      </span>

      <button onClick={exportJSON} style={toolBtn}>
        Export JSON
      </button>

      <button
        onClick={clearGraph}
        style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 6,
          color: '#ef4444',
          padding: '4px 10px',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        Clear
      </button>
    </div>
  )
}

const toolBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  color: '#aaa',
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
}

const toggleOn: React.CSSProperties = {
  background: 'rgba(139,92,246,0.12)',
  borderColor: 'rgba(139,92,246,0.3)',
  color: '#a78bfa',
}

/* ── Help panel ── */

function HelpBar() {
  return (
    <div style={{
      display: 'flex',
      gap: 16,
      padding: '6px 16px',
      background: '#08080a',
      borderTop: '1px solid rgba(255,255,255,0.04)',
      fontSize: 11,
      color: '#555',
    }}>
      <span><kbd style={kbd}>Left click</kbd> Select/Drag</span>
      <span><kbd style={kbd}>Right click</kbd> Pan / Context menu</span>
      <span><kbd style={kbd}>Scroll</kbd> Zoom</span>
      <span><kbd style={kbd}>Shift+Click</kbd> Multi-select</span>
      <span><kbd style={kbd}>Drag pin</kbd> Connect (see preview)</span>
      <span><kbd style={kbd}>Del</kbd> Delete</span>
      <span><kbd style={kbd}>Ctrl+Z/Y</kbd> Undo/Redo</span>
      <span><kbd style={kbd}>Ctrl+G</kbd> Group</span>
      <span><kbd style={kbd}>Ctrl+K</kbd> Search</span>
      <span><kbd style={kbd}>Dbl-click wire</kbd> Reroute</span>
    </div>
  )
}

const kbd: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 3,
  padding: '1px 5px',
  fontSize: 10,
  fontFamily: 'inherit',
  color: '#888',
}

/* ── App ── */

export function App() {
  const { store, registry } = useMemo(() => {
    const registry = new NodeRegistry()
    registry.registerMany(allNodeDefs)

    const validator = new Validator()
    validator.addRule(Validator.typeCompatibility())
    validator.addRule(Validator.noSelfConnection())
    validator.addRule(Validator.noDuplicateConnection())

    const store = new GraphStore({ validator })
    store.importGraph(initialGraph)
    return { store, registry }
  }, [])

  const fitViewRef = useRef<(() => void) | null>(null)
  const exportImageRef = useRef<((opts?: ExportImageOptions) => string) | null>(null)
  const [showMinimap, setShowMinimap] = useState(true)
  const [snapToAlignment, setSnapToAlignment] = useState(true)
  const [animateConnections, setAnimateConnections] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuEvent | null>(null)

  const handleFitView = useCallback(() => {
    fitViewRef.current?.()
  }, [])

  const handleExportPNG = useCallback(() => {
    const dataUrl = exportImageRef.current?.({ padding: 40, scale: 2 })
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'quantum-flow.png'
    a.click()
  }, [])

  const handleGroup = useCallback((nodeIds: string[]) => {
    createGroup(store, nodeIds)
  }, [store])

  const paletteItems: SearchPaletteItem[] = useMemo(() =>
    allNodeDefs.map(def => ({
      type: def.type,
      label: def.label,
      category: def.category,
      color: def.color,
    })),
  [])

  const handlePaletteSelect = useCallback((item: SearchPaletteItem, worldPos: { x: number; y: number }) => {
    const def = registry.get(item.type)
    if (!def) return
    store.addNode(def.createInstance(worldPos))
  }, [store, registry])

  const handleContextMenu = useCallback((event: ContextMenuEvent) => {
    setContextMenu(event)
  }, [])

  const closeMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleAddNodeAt = useCallback((type: string) => {
    if (!contextMenu) return
    const def = registry.get(type)
    if (!def) return
    const node = def.createInstance({ x: contextMenu.worldX, y: contextMenu.worldY })
    store.addNode(node)
    closeMenu()
  }, [store, registry, contextMenu, closeMenu])

  const handleDeleteNode = useCallback(() => {
    if (!contextMenu || contextMenu.target.type !== 'node') return
    store.removeNode(contextMenu.target.nodeId)
    closeMenu()
  }, [store, contextMenu, closeMenu])

  const handleDuplicateNode = useCallback(() => {
    if (!contextMenu || contextMenu.target.type !== 'node') return
    const original = store.getNode(contextMenu.target.nodeId)
    if (!original) return
    const def = registry.get(original.type)
    if (!def) return
    const node = def.createInstance({
      x: original.position.x + 30,
      y: original.position.y + 30,
    })
    store.addNode(node)
    closeMenu()
  }, [store, registry, contextMenu, closeMenu])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar
        store={store}
        registry={registry}
        onFitView={handleFitView}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(v => !v)}
        snapToAlignment={snapToAlignment}
        onToggleAlignment={() => setSnapToAlignment(v => !v)}
        animateConnections={animateConnections}
        onToggleAnimation={() => setAnimateConnections(v => !v)}
        onExportPNG={handleExportPNG}
      />
      <div style={{ flex: 1, position: 'relative' }}>
        <FlowCanvas
          store={store}
          width="100%"
          height="100%"
          snapToGrid={20}
          showMinimap={showMinimap}
          snapToAlignment={snapToAlignment}
          alignThreshold={6}
          animateConnections={animateConnections}
          onFitView={(fn) => { fitViewRef.current = fn }}
          onExportImage={(fn) => { exportImageRef.current = fn }}
          onContextMenu={handleContextMenu}
          onGroup={handleGroup}
          searchPalette={{ items: paletteItems, onSelect: handlePaletteSelect }}
        />

        {/* Context Menu */}
        <FlowContextMenu event={contextMenu} onClose={closeMenu}>
          {contextMenu?.target.type === 'canvas' && (
            <>
              {allNodeDefs.map(def => (
                <FlowContextMenuItem
                  key={def.type}
                  label={`Add ${def.label}`}
                  onClick={() => handleAddNodeAt(def.type)}
                />
              ))}
              <FlowContextMenuSeparator />
              <FlowContextMenuItem label="Fit View" onClick={() => { handleFitView(); closeMenu() }} shortcut="F" />
            </>
          )}
          {contextMenu?.target.type === 'node' && (
            <>
              <FlowContextMenuItem label="Duplicate" onClick={handleDuplicateNode} shortcut="Ctrl+D" />
              <FlowContextMenuSeparator />
              <FlowContextMenuItem label="Delete" onClick={handleDeleteNode} danger shortcut="Del" />
            </>
          )}
          {contextMenu?.target.type === 'pin' && (
            <>
              <FlowContextMenuItem
                label={`Pin: ${contextMenu.target.pinId}`}
                onClick={closeMenu}
                disabled
              />
              <FlowContextMenuItem
                label={contextMenu.target.isOutput ? 'Disconnect outputs' : 'Disconnect inputs'}
                onClick={closeMenu}
              />
            </>
          )}
        </FlowContextMenu>
      </div>
      <HelpBar />
    </div>
  )
}
