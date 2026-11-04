import { memo, useState, useRef, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface MindMapNodeData {
  label: string
  description?: string | null
  color?: string | null
  isCollapsed?: boolean
  hasChildren?: boolean
  onLabelChange?: (id: string, label: string) => void
  onToggleCollapse?: (id: string) => void
  [key: string]: unknown
}

function MindMapNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as MindMapNodeData
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(nodeData.label ?? '')
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLabel(nodeData.label ?? '') }, [nodeData.label])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const color = nodeData.color || '#0c7a82'
  const styleData = (data as Record<string, unknown>).style_data as Record<string, unknown> | null | undefined
  const size: 'sm' | 'md' | 'lg' = (styleData?.size as 'sm' | 'md' | 'lg') || 'md'
  const icon: string | undefined = styleData?.icon as string | undefined

  const sizeConfig = {
    sm: { minW: '100px', maxW: '180px', pad: '10px 14px', fontSize: '11px', descSize: '10px', iconSize: '16px' },
    md: { minW: '140px', maxW: '260px', pad: '14px 20px', fontSize: '13px', descSize: '11px', iconSize: '20px' },
    lg: { minW: '200px', maxW: '360px', pad: '18px 24px', fontSize: '16px', descSize: '12px', iconSize: '26px' },
  }[size]

  const commitEdit = () => {
    setEditing(false)
    const trimmed = label.trim()
    if (trimmed && trimmed !== nodeData.label) {
      nodeData.onLabelChange?.(id, trimmed)
    } else {
      setLabel(nodeData.label ?? '')
    }
  }

  const isActive = selected || hovered
  const isCollapsed = nodeData.isCollapsed
  const hasChildren = nodeData.hasChildren

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-card, #16161a)',
        border: `2px solid ${selected ? color : hovered ? `${color}80` : 'var(--border, rgba(255,255,255,0.06))'}`,
        borderRadius: size === 'lg' ? '16px' : '14px',
        padding: sizeConfig.pad,
        minWidth: sizeConfig.minW,
        maxWidth: sizeConfig.maxW,
        cursor: 'grab',
        boxShadow: selected
          ? `0 0 0 3px ${color}30, 0 8px 24px rgba(0,0,0,0.35)`
          : hovered
            ? `0 0 0 1px ${color}20, 0 4px 16px rgba(0,0,0,0.25)`
            : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'border-color 200ms, box-shadow 200ms, transform 100ms',
        transform: isActive ? 'scale(1.02)' : 'scale(1)',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{
        background: color, border: `2px solid var(--bg-card, #16161a)`,
        width: size === 'lg' ? 12 : 10, height: size === 'lg' ? 12 : 10, top: size === 'lg' ? -6 : -5,
      }} />

      {/* Color accent bar */}
      <div style={{
        width: isActive ? (size === 'lg' ? '48px' : '32px') : (size === 'lg' ? '32px' : '20px'),
        height: size === 'lg' ? '4px' : '3px', borderRadius: '2px',
        background: `linear-gradient(90deg, ${color}, ${color}88)`,
        margin: '0 auto 8px',
        transition: 'width 200ms ease',
      }} />

      {/* Icon/emoji */}
      {icon && (
        <div style={{
          textAlign: 'center',
          fontSize: sizeConfig.iconSize,
          lineHeight: 1,
          marginBottom: '6px',
        }}>
          {icon}
        </div>
      )}

      {editing ? (
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') { setLabel(nodeData.label ?? ''); setEditing(false) }
          }}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${color}40`,
            borderRadius: '6px',
            outline: 'none',
            color: 'var(--text-1, #f1f1f4)',
            fontSize: sizeConfig.fontSize,
            fontWeight: 600,
            textAlign: 'center',
            width: '100%',
            padding: '2px 6px',
          }}
        />
      ) : (
        <div style={{
          fontSize: sizeConfig.fontSize,
          fontWeight: size === 'lg' ? 700 : 600,
          color: 'var(--text-1, #f1f1f4)',
          textAlign: 'center',
          wordBreak: 'break-word',
          lineHeight: '1.4',
        }}>
          {nodeData.label}
        </div>
      )}

      {nodeData.description && (
        <div style={{
          fontSize: sizeConfig.descSize,
          color: 'var(--text-4, #6b6b78)',
          textAlign: 'center',
          marginTop: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: '1.4',
        }}>
          {nodeData.description}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{
        background: color, border: `2px solid var(--bg-card, #16161a)`,
        width: size === 'lg' ? 12 : 10, height: size === 'lg' ? 12 : 10, bottom: size === 'lg' ? -6 : -5,
      }} />

      {/* Collapse/expand toggle for nodes with children */}
      {hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            nodeData.onToggleCollapse?.(id)
          }}
          style={{
            position: 'absolute',
            bottom: '-18px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: color,
            border: `2px solid var(--bg-card, #16161a)`,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            lineHeight: 1,
            zIndex: 10,
            transition: 'transform 150ms',
            padding: 0,
          }}
          title={isCollapsed ? 'Expand children' : 'Collapse children'}
        >
          {isCollapsed ? '+' : '−'}
        </button>
      )}

      {/* Collapsed badge */}
      {isCollapsed && hasChildren && (
        <div style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: '#f59e0b',
          border: '2px solid var(--bg-card, #16161a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          fontWeight: 700,
          color: '#000',
          zIndex: 10,
        }}>
          <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
        </div>
      )}
    </div>
  )
}

export default memo(MindMapNodeComponent)
