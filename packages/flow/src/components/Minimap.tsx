import React, { useRef, useEffect, useCallback } from 'react'
import type { GraphStore } from '../model/GraphStore'
import type { ViewportAPI } from '../hooks/useViewport'
import type { FlowTheme } from './FlowCanvas'
import { nodeHeight } from '../hooks/hitTest'
import { NODE_W } from '../constants'

const MINIMAP_W = 180
const MINIMAP_H = 120

export interface MinimapProps {
  store: GraphStore
  viewport: ViewportAPI
  needsRedraw: React.MutableRefObject<boolean>
  canvasSize: { width: number; height: number }
  width?: number
  height?: number
  theme?: FlowTheme
  style?: React.CSSProperties
}

export const Minimap: React.FC<MinimapProps> = ({
  store,
  viewport,
  needsRedraw,
  canvasSize,
  width = MINIMAP_W,
  height = MINIMAP_H,
  theme: _theme,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef(false)
  const minimapDirty = useRef(true)

  const getWorldBounds = useCallback(() => {
    const nodes = store.getNodes()
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const node of nodes) {
      const w = node.width ?? NODE_W
      const h = nodeHeight(node)
      if (node.position.x < minX) minX = node.position.x
      if (node.position.y < minY) minY = node.position.y
      if (node.position.x + w > maxX) maxX = node.position.x + w
      if (node.position.y + h > maxY) maxY = node.position.y + h
    }

    // Add padding
    const padX = (maxX - minX) * 0.15 + 50
    const padY = (maxY - minY) * 0.15 + 50
    return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY }
  }, [store])

  const minimapToWorld = useCallback((mx: number, my: number, mw: number, mh: number) => {
    const bounds = getWorldBounds()
    const worldW = bounds.maxX - bounds.minX
    const worldH = bounds.maxY - bounds.minY
    return {
      x: bounds.minX + (mx / mw) * worldW,
      y: bounds.minY + (my / mh) * worldH,
    }
  }, [getWorldBounds])

  const centerViewportAt = useCallback((mx: number, my: number, mw: number, mh: number) => {
    const world = minimapToWorld(mx, my, mw, mh)
    const { zoom } = viewport.ref.current
    viewport.ref.current.offset = {
      x: canvasSize.width / 2 - world.x * zoom,
      y: canvasSize.height / 2 - world.y * zoom,
    }
    needsRedraw.current = true
    minimapDirty.current = true
  }, [viewport, canvasSize, needsRedraw, minimapToWorld])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    let rafId: number

    const paint = () => {
      // Only repaint when main canvas has changes or minimap is dragged
      if (!needsRedraw.current && !minimapDirty.current && !draggingRef.current) {
        rafId = requestAnimationFrame(paint)
        return
      }
      minimapDirty.current = false

      const mw = width
      const mh = height
      const targetW = mw * dpr
      const targetH = mh * dpr
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
      }

      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Background
      ctx.fillStyle = 'rgba(12, 12, 16, 0.85)'
      ctx.beginPath()
      ctx.roundRect(0, 0, mw, mh, 6)
      ctx.fill()

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.roundRect(0.5, 0.5, mw - 1, mh - 1, 6)
      ctx.stroke()

      const bounds = getWorldBounds()
      const worldW = bounds.maxX - bounds.minX
      const worldH = bounds.maxY - bounds.minY

      if (worldW <= 0 || worldH <= 0) {
        rafId = requestAnimationFrame(paint)
        return
      }

      const scale = Math.min(mw / worldW, mh / worldH)
      const drawW = worldW * scale
      const drawH = worldH * scale
      const ox = (mw - drawW) / 2
      const oy = (mh - drawH) / 2

      // Draw nodes
      const nodes = store.getNodes()
      for (const node of nodes) {
        const w = node.width ?? NODE_W
        const h = nodeHeight(node)
        const nx = ox + (node.position.x - bounds.minX) * scale
        const ny = oy + (node.position.y - bounds.minY) * scale
        const nw = w * scale
        const nh = h * scale

        const color = node.color ?? '#6366f1'
        ctx.fillStyle = color
        ctx.globalAlpha = 0.55
        ctx.beginPath()
        ctx.roundRect(nx, ny, Math.max(nw, 2), Math.max(nh, 2), 1.5)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // Viewport rect
      const { offset, zoom } = viewport.ref.current
      if (canvasSize.width > 0 && canvasSize.height > 0) {
        const vpWorldX = -offset.x / zoom
        const vpWorldY = -offset.y / zoom
        const vpWorldW = canvasSize.width / zoom
        const vpWorldH = canvasSize.height / zoom

        const rx = ox + (vpWorldX - bounds.minX) * scale
        const ry = oy + (vpWorldY - bounds.minY) * scale
        const rw = vpWorldW * scale
        const rh = vpWorldH * scale

        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 1
        ctx.strokeRect(rx, ry, rw, rh)
        ctx.fillStyle = 'rgba(255,255,255,0.03)'
        ctx.fillRect(rx, ry, rw, rh)
      }

      rafId = requestAnimationFrame(paint)
    }

    minimapDirty.current = true
    rafId = requestAnimationFrame(paint)

    // Mouse handlers
    const handleDown = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      draggingRef.current = true
      const rect = canvas.getBoundingClientRect()
      centerViewportAt(e.clientX - rect.left, e.clientY - rect.top, width, height)
    }

    const handleMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      centerViewportAt(e.clientX - rect.left, e.clientY - rect.top, width, height)
    }

    const handleUp = () => {
      draggingRef.current = false
    }

    canvas.addEventListener('mousedown', handleDown)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)

    return () => {
      cancelAnimationFrame(rafId)
      canvas.removeEventListener('mousedown', handleDown)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [store, viewport, canvasSize, width, height, getWorldBounds, centerViewportAt, needsRedraw])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        cursor: draggingRef.current ? 'grabbing' : 'grab',
        borderRadius: 6,
        ...style,
      }}
    />
  )
}
