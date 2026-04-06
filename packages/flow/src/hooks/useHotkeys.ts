import { useCallback, useRef } from 'react'
import type { GraphStore } from '../model/GraphStore'

export interface HotkeyOptions {
  selected: Set<string>
  clearSelection: () => void
  selectAll?: (nodeIds: string[]) => void
  select?: (nodeId: string) => void
  readOnly?: boolean
  onGroup?: (nodeIds: string[]) => void
  onSearchPalette?: () => void
  onMoveSelected?: (dx: number, dy: number) => void
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

    // Arrow keys: move selected nodes by grid step (or 1px with shift)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (opts.selected.size > 0 && opts.onMoveSelected) {
        const step = e.shiftKey ? 1 : 24
        const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0
        const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0
        opts.onMoveSelected(dx, dy)
        e.preventDefault()
      }
      return
    }

    // Tab: cycle through nodes (Shift+Tab = reverse)
    if (e.key === 'Tab') {
      const allNodes = store.getNodes()
      if (allNodes.length === 0) return
      e.preventDefault()

      const ids = allNodes.map(n => n.id)
      const currentId = opts.selected.size === 1 ? [...opts.selected][0] : null
      const currentIdx = currentId ? ids.indexOf(currentId) : -1

      let nextIdx: number
      if (e.shiftKey) {
        nextIdx = currentIdx <= 0 ? ids.length - 1 : currentIdx - 1
      } else {
        nextIdx = currentIdx < 0 || currentIdx >= ids.length - 1 ? 0 : currentIdx + 1
      }
      opts.select?.(ids[nextIdx])
      return
    }

    // Escape: clear selection
    if (e.key === 'Escape') {
      if (opts.selected.size > 0) {
        opts.clearSelection()
        e.preventDefault()
      }
      return
    }
  }, [store])

  return { handleKeyDown }
}
