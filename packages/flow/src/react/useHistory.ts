import { useMemo, useState, useEffect, useCallback } from 'react'
import { HistoryManager } from '../model/HistoryManager'
import type { GraphStore, GraphEvents } from '../model/GraphStore'

export interface UseHistoryOptions {
  maxSize?: number
}

export interface UseHistoryAPI {
  undo(): boolean
  redo(): boolean
  canUndo: boolean
  canRedo: boolean
  history: HistoryManager
}

export function useHistory(store: GraphStore, options?: UseHistoryOptions): UseHistoryAPI {
  const manager = useMemo(
    () => new HistoryManager(store, { maxSize: options?.maxSize }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store],
  )

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    const sync = () => {
      setCanUndo(manager.canUndo())
      setCanRedo(manager.canRedo())
    }

    const events: Array<keyof GraphEvents> = [
      'node:added', 'node:removed', 'node:moved', 'node:dataChanged',
      'connection:added', 'connection:removed', 'graph:cleared',
      'graph:imported', 'batch:end',
    ]

    const unsubs = events.map(event => store.events.on(event, sync))
    return () => { unsubs.forEach(unsub => unsub()) }
  }, [store, manager])

  const undo = useCallback(() => manager.undo(), [manager])
  const redo = useCallback(() => manager.redo(), [manager])

  return { undo, redo, canUndo, canRedo, history: manager }
}
