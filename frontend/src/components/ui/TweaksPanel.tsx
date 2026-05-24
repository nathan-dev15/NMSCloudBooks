import { useEffect, useRef } from 'react'
import { useThemeSettings, PRESETS, QUICK_ACCENTS } from '@/contexts/ThemeSettingsContext'
import type { Density, PresetKey } from '@/contexts/ThemeSettingsContext'

interface Props {
  open:    boolean
  onClose: () => void
}

// ── Segment button group ──────────────────────────────────────────────────────

function SegmentGroup<T extends string>({
  options, value, onChange,
}: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      {options.map(({ label, value: v }) => {
        const active = value === v
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className="flex-1 py-2 text-xs font-medium transition-all duration-150"
            style={active
              ? { background: 'rgba(var(--accent-rgb, 12,122,130),0.2)', color: 'var(--primary-400)', borderRight: '1px solid rgba(255,255,255,0.06)' }
              : { background: 'transparent', color: 'var(--text-muted)', borderRight: '1px solid rgba(255,255,255,0.06)' }
            }
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function TweaksPanel({ open, onClose }: Props) {
  const { density, preset, accentKey, setDensity, setPreset, setAccentKey } = useThemeSettings()
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{ background: 'rgba(0,0,0,0.4)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: '300px',
          background: 'linear-gradient(160deg, rgba(10,14,23,0.98) 0%, rgba(16,21,31,0.98) 50%, rgba(12,16,26,0.98) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(12,122,130,0.2)',
          boxShadow: '-12px 0 50px rgba(0,0,0,0.6), -4px 0 20px rgba(12,122,130,0.05)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-0.5"
              style={{ color: 'var(--primary-400)' }}>NMSCloudBooks</p>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Portal Tweaks</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: 'var(--text-faint)', border: '1px solid rgba(255,255,255,0.06)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* ── Density ── */}
          <section>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-3"
              style={{ color: 'var(--text-faint)' }}>Density</p>
            <SegmentGroup<Density>
              value={density}
              onChange={setDensity}
              options={[
                { label: 'Compact', value: 'compact' },
                { label: 'Regular', value: 'regular' },
                { label: 'Comfy',   value: 'comfy'   },
              ]}
            />
            <p className="text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>
              {density === 'compact' && 'Tighter spacing — more content visible'}
              {density === 'regular' && 'Default balanced spacing'}
              {density === 'comfy'   && 'Generous spacing — easier on the eyes'}
            </p>
          </section>

          {/* ── Theme Preset ── */}
          <section>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-3"
              style={{ color: 'var(--text-faint)' }}>Theme Preset</p>
            <div className="space-y-1.5">
              {(Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][]).map(([key, p]) => {
                const active = preset === key && !accentKey
                return (
                  <button
                    key={key}
                    onClick={() => setPreset(key)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150"
                    style={active
                      ? { background: 'rgba(12,122,130,0.15)', border: '1px solid rgba(12,122,130,0.35)' }
                      : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
                    }
                  >
                    {/* Color swatch */}
                    <div className="flex gap-0.5 flex-shrink-0">
                      <div className="w-3 h-5 rounded-sm" style={{ background: p.bg800 }} />
                      <div className="w-3 h-5 rounded-sm" style={{ background: p.p600  }} />
                    </div>
                    <span className="text-xs font-medium flex-1"
                      style={{ color: active ? 'var(--primary-400)' : 'var(--text-secondary)' }}>
                      {p.label}
                    </span>
                    {active && (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"
                        style={{ color: 'var(--primary-400)' }}>
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Quick Accent ── */}
          <section>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-3"
              style={{ color: 'var(--text-faint)' }}>Quick Accent</p>
            <div className="grid grid-cols-6 gap-2">
              {QUICK_ACCENTS.map((a) => {
                const active = accentKey === a.key
                return (
                  <button
                    key={a.key}
                    title={a.label}
                    onClick={() => setAccentKey(active ? null : a.key)}
                    className="relative w-full aspect-square rounded-xl transition-all duration-150"
                    style={{
                      background: a.color,
                      boxShadow: active ? `0 0 14px ${a.color}80, 0 0 0 2px ${a.color}` : 'none',
                      transform: active ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    {active && (
                      <svg className="absolute inset-0 m-auto w-3.5 h-3.5" fill="white" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>
              {accentKey
                ? `${QUICK_ACCENTS.find(a => a.key === accentKey)?.label} accent active — click again to clear`
                : 'Using preset accent color'}
            </p>
          </section>

          {/* ── Preview card ── */}
          <section>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-3"
              style={{ color: 'var(--text-faint)' }}>Preview</p>
            <div className="rounded-xl p-4 space-y-3" style={{
              background: 'var(--dark-800)',
              border: '1px solid rgba(12,122,130,0.2)',
            }}>
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, var(--primary-600) 0%, var(--primary-400) 100%)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Sample Component</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[10px] px-2 py-1 rounded-full font-medium" style={{
                  background: 'rgba(12,122,130,0.15)',
                  border: '1px solid rgba(12,122,130,0.3)',
                  color: 'var(--primary-400)',
                }}>Active</span>
                <span className="text-[10px] px-2 py-1 rounded-full font-medium" style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-muted)',
                }}>Inactive</span>
              </div>
              <div className="h-1 rounded-full" style={{ background: 'var(--dark-700)' }}>
                <div className="h-1 rounded-full w-2/3" style={{ background: 'linear-gradient(90deg, var(--primary-600) 0%, var(--primary-400) 100%)' }} />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(12,122,130,0.1)' }}>
          <p className="text-[10px] text-center" style={{ color: 'var(--text-faint)' }}>
            Settings saved automatically to your browser
          </p>
        </div>
      </div>
    </>
  )
}
