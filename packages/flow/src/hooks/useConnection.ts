import { useState, useCallback, useRef } from 'react'
import type { GraphStore } from '../model/GraphStore'
import type { PinHit } from './hitTest'

interface Vec2 { x: number; y: number }

export interface DraftConnection {
  fromNodeId: string
  fromPinId: string
  fromPos: Vec2
  toPos: Vec2
  isFromOutput: boolean
}

export interface ConnectionAPI {
  draft: DraftConnection | null
  startConnection(pin: PinHit): void
  updateDraft(worldPos: Vec2): void
  finishConnection(pin: PinHit): void
  cancelConnection(): void
}

function generateConnectionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useConnection(store: GraphStore): ConnectionAPI {
  const [draft, setDraft] = useState<DraftConnection | null>(null)
  const draftRef = useRef<DraftConnection | null>(null)

  const startConnection = useCallback((pin: PinHit) => {
    const newDraft: DraftConnection = {
      fromNodeId: pin.nodeId,
      fromPinId: pin.pinId,
      fromPos: pin.pos,
      toPos: pin.pos,
      isFromOutput: pin.isOutput,
    }
    draftRef.current = newDraft
    setDraft(newDraft)
  }, [])

  const updateDraft = useCallback((worldPos: Vec2) => {
    setDraft(prev => {
      if (!prev) return null
      const updated = { ...prev, toPos: worldPos }
      draftRef.current = updated
      return updated
    })
  }, [])

  const finishConnection = useCallback((pin: PinHit) => {
    const current = draftRef.current
    if (!current) return

    if (current.isFromOutput === pin.isOutput) {
      // Same direction — cancel
      draftRef.current = null
      setDraft(null)
      return
    }

    const fromNodeId = current.isFromOutput ? current.fromNodeId : pin.nodeId
    const fromPinId = current.isFromOutput ? current.fromPinId : pin.pinId
    const toNodeId = current.isFromOutput ? pin.nodeId : current.fromNodeId
    const toPinId = current.isFromOutput ? pin.pinId : current.fromPinId

    try {
      store.addConnection({ id: generateConnectionId(), fromNodeId, fromPinId, toNodeId, toPinId })
    } catch { /* validation failed */ }

    draftRef.current = null
    setDraft(null)
  }, [store])

  const cancelConnection = useCallback(() => {
    draftRef.current = null
    setDraft(null)
  }, [])

  return { draft, startConnection, updateDraft, finishConnection, cancelConnection }
}
