import { useReactFlow } from '@xyflow/react'
import Button from '@/components/ui/Button'

export type CanvasBg = 'dark' | 'light' | 'none'

interface MindMapToolbarProps {
  title: string
  isSaving: boolean
  onAddNode: () => void
  onDeleteSelected: () => void
  onExportPng: () => void
  onExportJson: () => void
  onImportJson: () => void
  onBack: () => void
  hasSelection: boolean
  selectionType?: 'node' | 'edge'
  canvasBg: CanvasBg
  onCanvasBgChange: (bg: CanvasBg) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onAutoLayout: () => void
  onShareLink: () => void
  showMinimap: boolean
  onToggleMinimap: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
}

export default function MindMapToolbar({
  title, isSaving, onAddNode, onDeleteSelected, onExportPng, onExportJson, onImportJson,
  onBack, hasSelection, selectionType, canvasBg, onCanvasBgChange, canUndo, canRedo, onUndo, onRedo,
  onAutoLayout, onShareLink, showMinimap, onToggleMinimap, searchQuery, onSearchChange,
}: MindMapToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div style={{
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '0 12px',
      background: 'rgba(12, 12, 15, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border, #2a3040)',
      flexShrink: 0,
    }}>
      {/* Back button */}
      <ToolBtn title="Back to mind maps" onClick={onBack}>
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </ToolBtn>

      {/* Title */}
      <h2 style={{
        fontSize: '14px', fontWeight: 600,
        color: 'var(--text-1)', flex: 1, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        padding: '0 4px',
      }}>
        {title}
      </h2>

      {/* Save status */}
      {isSaving && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px',
          borderRadius: 'var(--r-xl)',
          background: 'var(--accent-bg)',
          fontSize: '11px', fontWeight: 500,
          color: 'var(--accent)',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--accent)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          Saving
        </div>
      )}

      {/* Undo / Redo group */}
      <ToolGroup>
        <ToolBtn title="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </ToolBtn>
        <ToolBtn title="Redo (Ctrl+Y)" onClick={onRedo} disabled={!canRedo}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
          </svg>
        </ToolBtn>
      </ToolGroup>

      <Divider />

      {/* Zoom group */}
      <ToolGroup>
        <ToolBtn title="Zoom in" onClick={() => zoomIn()}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
          </svg>
        </ToolBtn>
        <ToolBtn title="Zoom out" onClick={() => zoomOut()}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6" />
          </svg>
        </ToolBtn>
        <ToolBtn title="Fit to screen" onClick={() => fitView({ padding: 0.2 })}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </ToolBtn>
      </ToolGroup>

      <Divider />

      {/* Node actions */}
      <Button size="xs" variant="primary" onClick={onAddNode}
        leftIcon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" /></svg>}
      >
        Add Node
      </Button>

      {hasSelection && (
        <Button size="xs" variant="danger" onClick={onDeleteSelected}
          leftIcon={selectionType === 'edge'
            ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" /></svg>
            : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
          }
        >
          {selectionType === 'edge' ? 'Delete Line' : 'Delete'}
        </Button>
      )}

      <Divider />

      {/* Export / Import group */}
      <ToolGroup>
        <ToolBtn title="Export as PNG" onClick={onExportPng}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25c0 .828.672 1.5 1.5 1.5z" />
          </svg>
        </ToolBtn>
        <ToolBtn title="Export as JSON" onClick={onExportJson}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </ToolBtn>
        <ToolBtn title="Import from JSON" onClick={onImportJson}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </ToolBtn>
      </ToolGroup>

      <Divider />

      {/* Canvas background switcher */}
      <BgSwitcher value={canvasBg} onChange={onCanvasBgChange} />

      <Divider />

      {/* Auto-layout, minimap toggle, share */}
      <ToolGroup>
        <ToolBtn title="Auto-layout (tidy up)" onClick={onAutoLayout}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
          </svg>
        </ToolBtn>
        <ToolBtn title={showMinimap ? 'Hide minimap' : 'Show minimap'} onClick={onToggleMinimap}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: showMinimap ? 1 : 0.5 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
        </ToolBtn>
        <ToolBtn title="Copy share link" onClick={onShareLink}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.382a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364l1.757 1.757" />
          </svg>
        </ToolBtn>
      </ToolGroup>

      <Divider />

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg-card, #16161a)',
        border: '1px solid var(--border, rgba(255,255,255,0.06))',
        borderRadius: '8px',
        padding: '0 8px',
        height: '30px',
        minWidth: '120px',
        maxWidth: '160px',
      }}>
        <svg width="12" height="12" fill="none" stroke="var(--text-4)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          data-mind-map-search
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Find node..."
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-1)', fontSize: '11px',
            padding: '0 6px', width: '100%', height: '100%',
          }}
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-4)', padding: '0', lineHeight: 0, flexShrink: 0,
          }}>
            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      gap: '2px',
      padding: '2px',
      background: 'var(--bg-card, #16161a)',
      border: '1px solid var(--border, rgba(255,255,255,0.06))',
      borderRadius: '8px',
    }}>
      {children}
    </div>
  )
}

function ToolBtn({ title, onClick, disabled, children }: {
  title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '30px', height: '28px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: '6px',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--text-5, #4a4a55)' : 'var(--text-3, #8a8a95)',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 150ms, color 150ms',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.03))'
          e.currentTarget.style.color = 'var(--text-1, #f1f1f4)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = disabled ? 'var(--text-5, #4a4a55)' : 'var(--text-3, #8a8a95)'
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div style={{ width: '1px', height: '20px', background: 'var(--border, rgba(255,255,255,0.06))', margin: '0 4px' }} />
}

const bgOptions: { value: CanvasBg; label: string; color: string; border: string }[] = [
  { value: 'dark', label: 'Dark', color: '#1a1a1f', border: 'rgba(255,255,255,0.15)' },
  { value: 'light', label: 'White', color: '#ffffff', border: 'rgba(0,0,0,0.15)' },
  { value: 'none', label: 'None', color: 'transparent', border: 'rgba(255,255,255,0.15)' },
]

function BgSwitcher({ value, onChange }: { value: CanvasBg; onChange: (bg: CanvasBg) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      padding: '2px',
      background: 'var(--bg-card, #16161a)',
      border: '1px solid var(--border, rgba(255,255,255,0.06))',
      borderRadius: '8px',
    }}>
      {bgOptions.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            title={`${opt.label} background`}
            onClick={() => onChange(opt.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 8px',
              border: 'none',
              borderRadius: '6px',
              background: active ? 'var(--bg-hover, rgba(255,255,255,0.03))' : 'transparent',
              cursor: 'pointer',
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.03))' }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              width: '14px', height: '14px',
              borderRadius: '4px',
              background: opt.value === 'none'
                ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 0 0 / 7px 7px'
                : opt.color,
              border: `1.5px solid ${active ? 'var(--accent)' : opt.border}`,
              flexShrink: 0,
              boxShadow: active ? '0 0 0 1px var(--accent)' : 'none',
              transition: 'border-color 150ms, box-shadow 150ms',
            }} />
            <span style={{
              fontSize: '10px', fontWeight: active ? 600 : 500,
              color: active ? 'var(--text-1)' : 'var(--text-4)',
              transition: 'color 150ms',
            }}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
