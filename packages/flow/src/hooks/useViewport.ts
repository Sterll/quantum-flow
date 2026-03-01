import { useRef, useCallback } from 'react'

export interface ViewportState {
  offset: { x: number; y: number }
  zoom: number
}

const ZOOM_MIN = 0.1
const ZOOM_MAX = 3.0

export interface ViewportAPI {
  ref: React.MutableRefObject<ViewportState>
  screenToWorld(sx: number, sy: number): { x: number; y: number }
  worldToScreen(wx: number, wy: number): { x: number; y: number }
  pan(dx: number, dy: number): void
  zoomAt(newZoom: number, screenX: number, screenY: number): void
}

export function useViewport(): ViewportAPI {
  const ref = useRef<ViewportState>({
    offset: { x: 0, y: 0 },
    zoom: 1,
  })

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const { offset, zoom } = ref.current
    return {
      x: (sx - offset.x) / zoom,
      y: (sy - offset.y) / zoom,
    }
  }, [])

  const worldToScreen = useCallback((wx: number, wy: number) => {
    const { offset, zoom } = ref.current
    return {
      x: wx * zoom + offset.x,
      y: wy * zoom + offset.y,
    }
  }, [])

  const pan = useCallback((dx: number, dy: number) => {
    ref.current.offset = {
      x: ref.current.offset.x + dx,
      y: ref.current.offset.y + dy,
    }
  }, [])

  const zoomAt = useCallback((newZoom: number, screenX: number, screenY: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom))
    const { offset, zoom: oldZoom } = ref.current
    const wx = (screenX - offset.x) / oldZoom
    const wy = (screenY - offset.y) / oldZoom
    ref.current.zoom = clamped
    ref.current.offset = {
      x: screenX - wx * clamped,
      y: screenY - wy * clamped,
    }
  }, [])

  return { ref, screenToWorld, worldToScreen, pan, zoomAt }
}
