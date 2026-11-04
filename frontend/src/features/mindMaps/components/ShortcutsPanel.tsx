interface ShortcutsPanelProps {
  open: boolean
  onClose: () => void
}

const shortcuts = [
  { keys: 'Double-click canvas', desc: 'Add node at position' },
  { keys: 'Double-click node', desc: 'Edit node label' },
  { keys: 'Double-click edge', desc: 'Edit edge label' },
  { keys: 'Right-click node', desc: 'Node context menu' },
  { keys: 'Delete / Backspace', desc: 'Delete selected' },
  { keys: 'Ctrl + Z', desc: 'Undo' },
  { keys: 'Ctrl + Y', desc: 'Redo' },
  { keys: 'Ctrl + S', desc: 'Save layout' },
  { keys: 'Ctrl + F', desc: 'Search nodes' },
  { keys: 'Escape', desc: 'Clear search / cancel' },
  { keys: 'Drag handle', desc: 'Connect nodes' },
  { keys: 'Scroll wheel', desc: 'Zoom in / out' },
  { keys: '?', desc: 'Toggle this help' },
]

export default function ShortcutsPanel({ open, onClose }: ShortcutsPanelProps) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'absolute', bottom: '16px', right: '16px',
        zIndex: 50,
        width: '260px',
        padding: '16px',
        background: 'var(--bg-card, #16161a)',
        border: '1px solid var(--border-strong)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)' }}>
          Keyboard Shortcuts
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-4)', padding: '2px', lineHeight: 0,
        }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {shortcuts.map((s) => (
          <div key={s.keys} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '8px',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{s.desc}</span>
            <span style={{
              fontSize: '10px', color: 'var(--text-4)',
              padding: '2px 6px',
              background: 'var(--bg-canvas)',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {s.keys}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
