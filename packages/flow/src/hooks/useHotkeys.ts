import { useCallback, useRef } from 'react'
import type { GraphStore } from '../model/GraphStore'

export interface HotkeyOptions {
  selected: Set<string>
  clearSelection: () => void
  selectAll?: (nodeIds: string[]) => void
  readOnly?: boolean
  onGroup?: (nodeIds: string[]) => void
  onSearchPalette?: () => void
}

export interface HotkeysAPI {
  handleKeyDown(e: KeyboardEvent): void
}

export function useHotkeys(store: GraphStore, options: HotkeyOptions): HotkeysAPI {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const opts = optionsRef.current
    if (opts.readOnly) return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (opts.selected.size === 0) return
      store.batch(() => {
        for (const nodeId of opts.selected) {
          store.removeNode(nodeId)
        }
      })
      opts.clearSelection()
      e.preventDefault()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      const allIds = store.getNodes().map(n => n.id)
      opts.selectAll?.(allIds)
      e.preventDefault()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
      if (opts.selected.size >= 2 && opts.onGroup) {
        opts.onGroup(Array.from(opts.selected))
        e.preventDefault()
      }
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      if (opts.onSearchPalette) {
        opts.onSearchPalette()
        e.preventDefault()
      }
      return
    }
  }, [store])

  return { handleKeyDown }
}
