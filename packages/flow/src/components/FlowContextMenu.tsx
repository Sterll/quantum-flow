import React, { useEffect, useRef } from 'react'
import type { ContextMenuEvent } from '../hooks/useCanvasInteraction'

export interface FlowContextMenuProps {
  event: ContextMenuEvent | null
  onClose: () => void
  children?: React.ReactNode
  style?: React.CSSProperties
}

export const FlowContextMenu: React.FC<FlowContextMenuProps> = ({
  event,
  onClose,
  children,
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!event) return

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('mousedown', handleClick, true)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick, true)
      window.removeEventListener('keydown', handleKey)
    }
  }, [event, onClose])

  if (!event) return null

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: event.screenX,
        top: event.screenY,
        zIndex: 9999,
        minWidth: 160,
        padding: '4px 0',
        background: '#1a1a24',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        fontSize: 13,
        color: '#e0e0e8',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export interface FlowContextMenuItemProps {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  shortcut?: string
}

export const FlowContextMenuItem: React.FC<FlowContextMenuItemProps> = ({
  label,
  onClick,
  disabled,
  danger,
  shortcut,
}) => {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '6px 12px',
        background: 'transparent',
        border: 'none',
        color: disabled ? 'rgba(255,255,255,0.25)' : danger ? '#f87171' : '#e0e0e8',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 13,
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      <span>{label}</span>
      {shortcut && (
        <span style={{ marginLeft: 24, fontSize: 11, opacity: 0.4 }}>{shortcut}</span>
      )}
    </button>
  )
}

export const FlowContextMenuSeparator: React.FC = () => (
  <div style={{ height: 1, margin: '4px 8px', background: 'rgba(255,255,255,0.06)' }} />
)
