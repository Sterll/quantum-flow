import { useCallback } from 'react'
import type { GraphStore } from '../model/GraphStore'

export interface HotkeyOptions {
  selected: Set<string>
  clearSelection: () => void
  selectAll?: (nodeIds: string[]) => void
  readOnly?: boolean
}

export interface HotkeysAPI {
  handleKeyDown(e: KeyboardEvent): void
}

export function useHotkeys(store: GraphStore, options: HotkeyOptions): HotkeysAPI {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (options.readOnly) return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (options.selected.size === 0) return
      store.batch(() => {
        for (const nodeId of options.selected) {
          store.removeNode(nodeId)
        }
      })
      options.clearSelection()
      e.preventDefault()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      const allIds = store.getNodes().map(n => n.id)
      options.selectAll?.(allIds)
      e.preventDefault()
      return
    }
  }, [store, options])

  return { handleKeyDown }
}
