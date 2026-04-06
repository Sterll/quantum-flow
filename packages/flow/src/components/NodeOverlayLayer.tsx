import React, { useRef, useEffect, useState, useCallback } from 'react'
import type { GraphStore } from '../model/GraphStore'
import type { NodeRegistry } from '../define/NodeRegistry'
import type { ViewportAPI } from '../hooks/useViewport'
import { nodeHeight } from '../hooks/hitTest'
import { NODE_W, TITLE_H } from '../constants'

export interface NodeOverlayLayerProps {
  store: GraphStore
  registry: NodeRegistry
  viewport: ViewportAPI
  selectedIds: React.MutableRefObject<Set<string>>
}

/* ---------- per-node wrapper ---------- */

interface WrapperProps {
  nodeId: string
  store: GraphStore
  registry: NodeRegistry
  selectedIds: React.MutableRefObject<Set<string>>
  onMount: (id: string, el: HTMLDivElement) => void
  onUnmount: (id: string) => void
}

const NodeOverlayWrapper: React.FC<WrapperProps> = ({
  nodeId, store, registry, selectedIds, onMount, onUnmount,
}) => {
  const divRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<Record<string, unknown>>(() => {
    const n = store.getNode(nodeId)
    return n?.data ? { ...n.data } : {}
  })
  const [selected, setSelected] = useState(false)

  const node = store.getNode(nodeId)
  const def = node ? registry.get(node.type) : undefined
  const Component = def?.component

  const width = node ? (node.width ?? NODE_W) : NODE_W
  const contentHeight = node ? nodeHeight(node) - TITLE_H - 10 : 0

  // Register div ref for RAF position sync
  useEffect(() => {
    const el = divRef.current
    if (el) onMount(nodeId, el)
    return () => onUnmount(nodeId)
  }, [nodeId, onMount, onUnmount])

  // Subscribe to data changes for this node only
  useEffect(() => {
    const unsub = store.events.on('node:dataChanged', ({ nodeId: changedId, data: newData }) => {
      if (changedId === nodeId) setData({ ...newData })
    })
    return unsub
  }, [store, nodeId])

  // Poll selection from ref (cheap: one Set.has per frame)
  useEffect(() => {
    let rafId: number
    const check = () => {
      const isSel = selectedIds.current.has(nodeId)
      setSelected(prev => prev !== isSel ? isSel : prev)
      rafId = requestAnimationFrame(check)
    }
    rafId = requestAnimationFrame(check)
    return () => cancelAnimationFrame(rafId)
  }, [nodeId, selectedIds])

  const updateData = useCallback((patch: Record<string, unknown>) => {
    const current = store.getNode(nodeId)
    if (current) {
      store.updateNodeData(nodeId, { ...current.data, ...patch })
    }
  }, [store, nodeId])

  if (!Component || !node) return null

  return (
    <div
      ref={divRef}
      style={{
        position: 'absolute',
        width: `${width}px`,
        height: `${contentHeight}px`,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto', width: '100%', height: '100%' }}>
        <Component
          nodeId={nodeId}
          data={data}
          updateData={updateData}
          width={width}
          height={contentHeight}
          selected={selected}
        />
      </div>
    </div>
  )
}

/* ---------- overlay layer ---------- */

export const NodeOverlayLayer: React.FC<NodeOverlayLayerProps> = ({
  store, registry, viewport, selectedIds,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const [overlayNodeIds, setOverlayNodeIds] = useState<string[]>([])

  // Rebuild overlay node list on structural graph changes
  useEffect(() => {
    const rebuild = () => {
      const nodes = store.getNodes()
      const ids = nodes
        .filter(n => {
          const def = registry.get(n.type)
          return def?.component != null
        })
        .map(n => n.id)
      setOverlayNodeIds(ids)
    }
    rebuild()
    const unsubs = [
      store.events.on('node:added', rebuild),
      store.events.on('node:removed', rebuild),
      store.events.on('graph:imported', rebuild),
      store.events.on('graph:cleared', rebuild),
    ]
    return () => unsubs.forEach(u => u())
  }, [store, registry])

  // RAF loop: sync viewport transform + node positions to DOM (no React re-renders)
  useEffect(() => {
    let rafId: number
    let lastOx = NaN
    let lastOy = NaN
    let lastZoom = NaN

    const sync = () => {
      const { offset, zoom } = viewport.ref.current
      const container = containerRef.current

      // Sync viewport transform (only write if changed)
      if (container && (offset.x !== lastOx || offset.y !== lastOy || zoom !== lastZoom)) {
        container.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
        lastOx = offset.x
        lastOy = offset.y
        lastZoom = zoom
      }

      // Sync each node overlay position
      for (const [nodeId, div] of nodeRefsMap.current) {
        const node = store.getNode(nodeId)
        if (!node) continue
        div.style.left = `${node.position.x}px`
        div.style.top = `${node.position.y + TITLE_H}px`
      }

      rafId = requestAnimationFrame(sync)
    }

    rafId = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(rafId)
  }, [viewport, store])

  const handleMount = useCallback((id: string, el: HTMLDivElement) => {
    nodeRefsMap.current.set(id, el)
  }, [])

  const handleUnmount = useCallback((id: string) => {
    nodeRefsMap.current.delete(id)
  }, [])

  if (overlayNodeIds.length === 0) return null

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 1,
    }}>
      <div
        ref={containerRef}
        style={{ transformOrigin: '0 0', position: 'absolute' }}
      >
        {overlayNodeIds.map(nodeId => (
          <NodeOverlayWrapper
            key={nodeId}
            nodeId={nodeId}
            store={store}
            registry={registry}
            selectedIds={selectedIds}
            onMount={handleMount}
            onUnmount={handleUnmount}
          />
        ))}
      </div>
    </div>
  )
}
