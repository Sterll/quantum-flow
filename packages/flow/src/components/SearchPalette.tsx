import React, { useRef, useState, useEffect, useCallback } from 'react'

export interface SearchPaletteItem {
  type: string
  label: string
  category?: string
  color?: string
}

export interface SearchPaletteProps {
  open: boolean
  onClose: () => void
  items: SearchPaletteItem[]
  onSelect: (item: SearchPaletteItem, worldPos: { x: number; y: number }) => void
  viewportCenter: { x: number; y: number }
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

export const SearchPalette: React.FC<SearchPaletteProps> = ({
  open, onClose, items, onSelect, viewportCenter,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)

  const filtered = query
    ? items.filter(it => fuzzyMatch(query, it.label) || (it.category && fuzzyMatch(query, it.category)))
    : items

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => { setActiveIdx(0) }, [query])

  const pick = useCallback((item: SearchPaletteItem) => {
    onSelect(item, viewportCenter)
  }, [onSelect, viewportCenter])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' && filtered.length > 0) { pick(filtered[activeIdx]); return }
  }, [onClose, filtered, activeIdx, pick])

  if (!open) return null

  return (
    <div style={S.backdrop} onMouseDown={onClose}>
      <div style={S.panel} onMouseDown={e => e.stopPropagation()} onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          style={S.input}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search nodes..."
          spellCheck={false}
        />
        <div style={S.list}>
          {filtered.length === 0 && (
            <div style={S.empty}>No results</div>
          )}
          {filtered.map((item, idx) => (
            <div
              key={`${item.type}-${idx}`}
              style={{
                ...S.row,
                ...(idx === activeIdx ? S.rowActive : {}),
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseDown={() => pick(item)}
            >
              {item.color && <span style={{ ...S.dot, backgroundColor: item.color }} />}
              <span style={S.label}>{item.label}</span>
              {item.category && <span style={S.cat}>{item.category}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'absolute', inset: 0,
    display: 'flex', justifyContent: 'center', paddingTop: 80,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 50,
  },
  panel: {
    width: 360, maxHeight: 360,
    background: '#1a1a24', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
    alignSelf: 'flex-start',
  },
  input: {
    width: '100%', padding: '12px 16px',
    background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
    color: '#e0e0e8', fontSize: 14, outline: 'none',
    fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
  },
  list: {
    overflowY: 'auto', flex: 1,
    padding: '4px 0',
  },
  empty: {
    padding: '16px', textAlign: 'center',
    color: 'rgba(255,255,255,0.3)', fontSize: 13,
    fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', cursor: 'pointer',
    color: '#c8c8d0', fontSize: 13,
    fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
  },
  rowActive: {
    background: 'rgba(99,102,241,0.15)',
    color: '#e0e0e8',
  },
  dot: {
    width: 8, height: 8, borderRadius: '50%',
    flexShrink: 0,
  },
  label: {
    flex: 1, overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  cat: {
    color: 'rgba(255,255,255,0.3)', fontSize: 11,
    flexShrink: 0,
  },
}
