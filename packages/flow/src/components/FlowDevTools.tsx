import React, { useState, useEffect, useRef } from 'react'
import type { GraphStore } from '../model/GraphStore'
import type { ViewportAPI } from '../hooks/useViewport'

export interface FlowDevToolsProps {
  store: GraphStore
  viewport?: ViewportAPI
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

interface EventLogEntry {
  type: string
  time: number
  detail: string
}

const MAX_LOG = 50

export const FlowDevTools: React.FC<FlowDevToolsProps> = ({
  store,
  viewport,
  position = 'bottom-left',
}) => {
  const [nodeCount, setNodeCount] = useState(0)
  const [connCount, setConnCount] = useState(0)
  const [viewportState, setViewportState] = useState({ x: 0, y: 0, zoom: 1 })
  const [events, setEvents] = useState<EventLogEntry[]>([])
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<'state' | 'events'>('state')
  const logRef = useRef<HTMLDivElement>(null)

  // Sync counts
  useEffect(() => {
    const update = () => {
      setNodeCount(store.getNodes().length)
      setConnCount(store.getConnections().length)
    }
    update()
    const unsubs = [
      store.events.on('node:added', update),
      store.events.on('node:removed', update),
      store.events.on('connection:added', update),
      store.events.on('connection:removed', update),
      store.events.on('graph:imported', update),
      store.events.on('graph:cleared', update),
    ]
    return () => unsubs.forEach(u => u())
  }, [store])

  // Log events
  useEffect(() => {
    const logEvent = (type: string) => (payload: unknown) => {
      const detail = JSON.stringify(payload).slice(0, 80)
      setEvents(prev => [...prev.slice(-(MAX_LOG - 1)), { type, time: Date.now(), detail }])
    }
    const types = [
      'node:added', 'node:removed', 'node:moved', 'node:dataChanged',
      'connection:added', 'connection:removed', 'connection:updated',
      'graph:cleared', 'graph:imported', 'batch:start', 'batch:end',
    ] as const
    const unsubs = types.map(t => store.events.on(t, logEvent(t)))
    return () => unsubs.forEach(u => u())
  }, [store])

  // Sync viewport
  useEffect(() => {
    if (!viewport) return
    let rafId: number
    const sync = () => {
      const { offset, zoom } = viewport.ref.current
      setViewportState(prev => {
        if (prev.x !== offset.x || prev.y !== offset.y || prev.zoom !== zoom) {
          return { x: Math.round(offset.x), y: Math.round(offset.y), zoom: Math.round(zoom * 100) / 100 }
        }
        return prev
      })
      rafId = requestAnimationFrame(sync)
    }
    rafId = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(rafId)
  }, [viewport])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [events])

  const posStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    ...(position.includes('top') ? { top: 8 } : { bottom: 8 }),
    ...(position.includes('left') ? { left: 8 } : { right: 8 }),
  }

  const baseStyle: React.CSSProperties = {
    ...posStyle,
    background: 'rgba(17, 17, 21, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#e0e0e8',
    fontFamily: 'monospace',
    fontSize: 11,
    pointerEvents: 'auto',
    userSelect: 'text',
    minWidth: expanded ? 320 : 'auto',
  }

  if (!expanded) {
    return (
      <div style={baseStyle}>
        <button
          onClick={() => setExpanded(true)}
          style={{
            background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer',
            padding: '6px 10px', fontSize: 11, fontFamily: 'monospace',
          }}
        >
          DevTools ({nodeCount}N / {connCount}C)
        </button>
      </div>
    )
  }

  return (
    <div style={baseStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setTab('state')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', color: tab === 'state' ? '#a78bfa' : '#888' }}
          >
            State
          </button>
          <button
            onClick={() => setTab('events')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', color: tab === 'events' ? '#a78bfa' : '#888' }}
          >
            Events ({events.length})
          </button>
        </div>
        <button
          onClick={() => setExpanded(false)}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13 }}
        >
          x
        </button>
      </div>

      {tab === 'state' && (
        <div style={{ padding: '8px 10px' }}>
          <div style={{ marginBottom: 4 }}>Nodes: <span style={{ color: '#34d399' }}>{nodeCount}</span></div>
          <div style={{ marginBottom: 4 }}>Connections: <span style={{ color: '#60a5fa' }}>{connCount}</span></div>
          {viewport && (
            <>
              <div style={{ marginBottom: 4 }}>Viewport: <span style={{ color: '#fbbf24' }}>{viewportState.x}, {viewportState.y}</span></div>
              <div>Zoom: <span style={{ color: '#fbbf24' }}>{viewportState.zoom}x</span></div>
            </>
          )}
        </div>
      )}

      {tab === 'events' && (
        <div ref={logRef} style={{ padding: '4px 0', maxHeight: 200, overflow: 'auto' }}>
          {events.length === 0 && (
            <div style={{ padding: '8px 10px', color: '#666' }}>No events yet</div>
          )}
          {events.map((ev, i) => (
            <div key={i} style={{ padding: '2px 10px', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ color: '#a78bfa' }}>{ev.type}</span>{' '}
              <span style={{ color: '#666' }}>{ev.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
