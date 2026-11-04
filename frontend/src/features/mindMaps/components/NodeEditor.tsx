import { useState, useEffect, useCallback } from 'react'
import Input from '@/components/ui/Input'

const COLORS: { hex: string; name: string }[] = [
  { hex: '#0c7a82', name: 'Teal' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#8b5cf6', name: 'Purple' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#6366f1', name: 'Indigo' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#14b8a6', name: 'Cyan' },
]

const SIZES: { value: string; label: string; desc: string }[] = [
  { value: 'sm', label: 'S', desc: 'Small' },
  { value: 'md', label: 'M', desc: 'Medium' },
  { value: 'lg', label: 'L', desc: 'Large' },
]

const EMOJI_OPTIONS = [
  '💡', '⭐', '🎯', '🔥', '✅', '❌', '⚡', '🚀',
  '📌', '📝', '🔑', '💎', '🎨', '🧩', '📊', '🔔',
  '❤️', '👍', '⚠️', '🏆', '📁', '🔗', '💬', '🧠',
]

interface NodeEditorProps {
  nodeId: string
  title: string
  description: string | null
  color: string | null
  size: string
  icon: string | null
  onUpdate: (nodeId: string, data: { title?: string; description?: string; color?: string; style_data?: Record<string, unknown> }) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
}

export default function NodeEditor({ nodeId, title, description, color, size, icon, onUpdate, onDelete, onClose }: NodeEditorProps) {
  const [editTitle, setEditTitle] = useState(title)
  const [editDesc, setEditDesc] = useState(description ?? '')
  const [editColor, setEditColor] = useState(color ?? '#0c7a82')
  const [editSize, setEditSize] = useState(size)
  const [editIcon, setEditIcon] = useState(icon ?? '')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setEditTitle(title)
    setEditDesc(description ?? '')
    setEditColor(color ?? '#0c7a82')
    setEditSize(size)
    setEditIcon(icon ?? '')
  }, [nodeId, title, description, color, size, icon])

  const handleSave = useCallback(() => {
    onUpdate(nodeId, {
      title: editTitle.trim() || title,
      description: editDesc.trim() || undefined,
      color: editColor,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [nodeId, editTitle, editDesc, editColor, title, onUpdate])

  return (
    <div style={{
      width: '280px',
      background: 'var(--bg-card, #16161a)',
      borderLeft: '1px solid var(--border, rgba(255,255,255,0.06))',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '2px',
            background: editColor,
          }} />
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)' }}>Edit Node</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {saved && (
            <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 500 }}>
              Saved
            </span>
          )}
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-4)', padding: '4px', lineHeight: 0,
            borderRadius: '4px',
            transition: 'background 150ms, color 150ms',
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.color = 'var(--text-4)'
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }} className="space-y-5">
        {/* Title */}
        <div>
          <Input
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          />
        </div>

        {/* Description */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px', fontWeight: 600,
            color: 'var(--text-3)',
            marginBottom: '6px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            Description
          </label>
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            onBlur={handleSave}
            rows={3}
            placeholder="Add a description..."
            style={{
              width: '100%',
              resize: 'vertical',
              fontSize: '13px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'var(--bg-canvas, #0a0a0c)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
              outline: 'none',
              lineHeight: '1.5',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          />
        </div>

        {/* Icon / Emoji picker */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px', fontWeight: 600,
            color: 'var(--text-3)',
            marginBottom: '8px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            Icon
          </label>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {/* Clear button */}
            <button
              title="No icon"
              onClick={() => {
                setEditIcon('')
                onUpdate(nodeId, { style_data: { size: editSize, icon: null } })
                setSaved(true)
                setTimeout(() => setSaved(false), 1500)
              }}
              style={{
                width: '30px', height: '30px',
                borderRadius: '8px',
                border: !editIcon ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                background: !editIcon ? 'var(--accent-bg, rgba(94,234,212,0.08))' : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px',
                color: 'var(--text-4)',
                transition: 'all 150ms',
              }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </button>
            {EMOJI_OPTIONS.map((emoji) => {
              const active = editIcon === emoji
              return (
                <button
                  key={emoji}
                  onClick={() => {
                    setEditIcon(emoji)
                    onUpdate(nodeId, { style_data: { size: editSize, icon: emoji } })
                    setSaved(true)
                    setTimeout(() => setSaved(false), 1500)
                  }}
                  style={{
                    width: '30px', height: '30px',
                    borderRadius: '8px',
                    border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                    background: active ? 'var(--accent-bg, rgba(94,234,212,0.08))' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '16px',
                    lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 150ms',
                    transform: active ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px', fontWeight: 600,
            color: 'var(--text-3)',
            marginBottom: '8px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            Color
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {COLORS.map((c) => {
              const active = editColor === c.hex
              return (
                <button
                  key={c.hex}
                  title={c.name}
                  onClick={() => { setEditColor(c.hex); onUpdate(nodeId, { color: c.hex }) }}
                  style={{
                    width: '30px', height: '30px',
                    borderRadius: '8px',
                    background: c.hex,
                    border: active ? '2px solid var(--text-1)' : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: active ? `0 0 0 2px ${c.hex}60` : 'none',
                    transition: 'border-color 150ms, box-shadow 150ms, transform 100ms',
                    transform: active ? 'scale(1.1)' : 'scale(1)',
                    position: 'relative',
                  }}
                >
                  {active && (
                    <svg
                      width="14" height="14" fill="none" stroke="#fff" viewBox="0 0 24 24"
                      style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '6px' }}>
            {COLORS.find((c) => c.hex === editColor)?.name ?? 'Custom'}
          </p>
        </div>

        {/* Size picker */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '11px', fontWeight: 600,
            color: 'var(--text-3)',
            marginBottom: '8px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            Size
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {SIZES.map((s) => {
              const active = editSize === s.value
              return (
                <button
                  key={s.value}
                  title={s.desc}
                  onClick={() => {
                    setEditSize(s.value)
                    onUpdate(nodeId, { style_data: { size: s.value, ...(editIcon ? { icon: editIcon } : {}) } })
                    setSaved(true)
                    setTimeout(() => setSaved(false), 1500)
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: '8px',
                    border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                    background: active ? 'var(--accent-bg, rgba(94,234,212,0.08))' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-3)',
                    fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '6px' }}>
            {SIZES.find((s) => s.value === editSize)?.desc ?? 'Medium'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={() => onDelete(nodeId)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid rgba(239,68,68,0.2)',
            background: 'rgba(239,68,68,0.06)',
            color: '#ef4444',
            fontSize: '12px', fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 150ms, border-color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.35)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.06)'
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'
          }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Delete Node
        </button>
      </div>
    </div>
  )
}
