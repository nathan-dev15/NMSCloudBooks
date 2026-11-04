import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Density   = 'compact' | 'regular' | 'comfy'
export type PresetKey = 'midnight-teal' | 'crimson' | 'deep-purple' | 'ocean-blue' | 'forest' | 'obsidian'
export type ColorMode = 'light' | 'dark'

interface Preset {
  label:    string
  bg900:    string; bg800: string; bg700: string; bg600: string
  p600:     string; p500:  string; p400:  string; p700:  string; p800: string
  glowRgb:  string
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const PRESETS: Record<PresetKey, Preset> = {
  'midnight-teal': {
    label: 'Midnight Teal',
    bg900: '#0a0a0c', bg800: '#16161a', bg700: '#1a1a1f', bg600: '#22222a',
    p600:  '#0c7a82', p500:  '#0e949e', p400:  '#2aacb5', p700:  '#0a6269', p800: '#094d56',
    glowRgb: '94,234,212',
  },
  'crimson': {
    label: 'Crimson',
    bg900: '#0f0809', bg800: '#1a1012', bg700: '#241820', bg600: '#2e2028',
    p600:  '#dc143c', p500:  '#e82a50', p400:  '#f05070', p700:  '#b01030', p800: '#8c0c26',
    glowRgb: '220,20,60',
  },
  'deep-purple': {
    label: 'Deep Purple',
    bg900: '#0c0a14', bg800: '#14101f', bg700: '#1e1830', bg600: '#28223e',
    p600:  '#7c3aed', p500:  '#8b5cf6', p400:  '#a78bfa', p700:  '#6025d1', p800: '#4b1db8',
    glowRgb: '124,58,237',
  },
  'ocean-blue': {
    label: 'Ocean Blue',
    bg900: '#080c14', bg800: '#0e1420', bg700: '#16202e', bg600: '#1e2c3c',
    p600:  '#1d4ed8', p500:  '#3b82f6', p400:  '#60a5fa', p700:  '#1740b0', p800: '#12338e',
    glowRgb: '59,130,246',
  },
  'forest': {
    label: 'Forest',
    bg900: '#080e09', bg800: '#0e1610', bg700: '#16221a', bg600: '#1e2c22',
    p600:  '#059669', p500:  '#10b981', p400:  '#34d399', p700:  '#047857', p800: '#065f46',
    glowRgb: '5,150,105',
  },
  'obsidian': {
    label: 'Obsidian',
    bg900: '#080808', bg800: '#111111', bg700: '#1a1a1a', bg600: '#222222',
    p600:  '#ea580c', p500:  '#f97316', p400:  '#fb923c', p700:  '#c2410c', p800: '#9a3412',
    glowRgb: '249,115,22',
  },
}

// ── Quick accents ─────────────────────────────────────────────────────────────

export interface QuickAccent {
  key:     string
  color:   string
  rgb:     string
  label:   string
  p400:    string
  p500:    string
  p600:    string
  p700:    string
  p800:    string
}

export const QUICK_ACCENTS: QuickAccent[] = [
  { key: 'teal',    color: '#0c7a82', rgb: '12,122,130',  label: 'Teal',    p400: '#2aacb5', p500: '#0e949e', p600: '#0c7a82', p700: '#0a6269', p800: '#094d56' },
  { key: 'purple',  color: '#7c3aed', rgb: '124,58,237',  label: 'Purple',  p400: '#a78bfa', p500: '#8b5cf6', p600: '#7c3aed', p700: '#6025d1', p800: '#4b1db8' },
  { key: 'amber',   color: '#d97706', rgb: '217,119,6',   label: 'Amber',   p400: '#fbbf24', p500: '#f59e0b', p600: '#d97706', p700: '#b45309', p800: '#92400e' },
  { key: 'crimson', color: '#dc143c', rgb: '220,20,60',   label: 'Crimson', p400: '#f05070', p500: '#e82a50', p600: '#dc143c', p700: '#b01030', p800: '#8c0c26' },
  { key: 'green',   color: '#059669', rgb: '5,150,105',   label: 'Green',   p400: '#34d399', p500: '#10b981', p600: '#059669', p700: '#047857', p800: '#065f46' },
  { key: 'blue',    color: '#2563eb', rgb: '37,99,235',   label: 'Blue',    p400: '#60a5fa', p500: '#3b82f6', p600: '#2563eb', p700: '#1d4ed8', p800: '#1e40af' },
]

// ── Context ───────────────────────────────────────────────────────────────────

interface ThemeSettings {
  density:   Density
  preset:    PresetKey
  accentKey: string | null
  mode:      ColorMode
}

interface ThemeSettingsCtx extends ThemeSettings {
  setDensity:   (d: Density) => void
  setPreset:    (p: PresetKey) => void
  setAccentKey: (k: string | null) => void
  setMode:      (m: ColorMode) => void
  toggleMode:   () => void
}

const ThemeSettingsContext = createContext<ThemeSettingsCtx>({} as ThemeSettingsCtx)

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'nms_theme_settings'

function load(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Spread defaults so older stored objects without `mode` get light by default
      return { density: 'regular', preset: 'midnight-teal', accentKey: null, mode: 'light', ...parsed }
    }
  } catch {}
  return { density: 'regular', preset: 'midnight-teal', accentKey: null, mode: 'light' }
}

function save(s: ThemeSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

// ── Token application ─────────────────────────────────────────────────────────

function applyTheme(settings: ThemeSettings) {
  const root = document.documentElement
  const preset = PRESETS[settings.preset]

  if (settings.mode === 'light') {
    // ── Light mode tokens ──────────────────────────────────────────
    root.style.setProperty('--bg-canvas',     '#f4f4f8')
    root.style.setProperty('--bg-sidebar',    '#ecedf2')
    root.style.setProperty('--bg-card',       '#ffffff')
    root.style.setProperty('--bg-card-hi',    '#f8f8fb')
    root.style.setProperty('--bg-hover',      'rgba(0,0,0,0.04)')
    root.style.setProperty('--bg-active',     'rgba(13,148,136,0.10)')

    root.style.setProperty('--border',        'rgba(0,0,0,0.09)')
    root.style.setProperty('--border-strong', 'rgba(0,0,0,0.15)')
    root.style.setProperty('--border-soft',   'rgba(0,0,0,0.05)')

    root.style.setProperty('--text-1', '#0d0d10')
    root.style.setProperty('--text-2', '#323240')
    root.style.setProperty('--text-3', '#6a6a78')
    root.style.setProperty('--text-4', '#9494a8')
    root.style.setProperty('--text-5', '#bcbccc')

    root.style.setProperty('--accent',      '#0d9488')
    root.style.setProperty('--accent-hi',   '#0f766e')
    root.style.setProperty('--accent-bg',   'rgba(13,148,136,0.10)')
    root.style.setProperty('--accent-glow', 'rgba(13,148,136,0.20)')
    root.style.setProperty('--accent-ink',  '#ffffff')

    root.style.setProperty('--status-active',   '#166534')
    root.style.setProperty('--status-progress', '#1e40af')
    root.style.setProperty('--status-planning', '#4b5563')
    root.style.setProperty('--status-hold',     '#92400e')
    root.style.setProperty('--status-done',     '#065f46')
    root.style.setProperty('--status-error',    '#991b1b')

    // Legacy
    root.style.setProperty('--dark-900', '#f4f4f8')
    root.style.setProperty('--dark-800', '#ffffff')
    root.style.setProperty('--dark-700', '#ecedf2')
    root.style.setProperty('--dark-600', '#e0e1e8')
    root.style.setProperty('--dark-500', '#d0d1dc')
    root.style.setProperty('--text-primary',   '#0d0d10')
    root.style.setProperty('--text-secondary', '#323240')
    root.style.setProperty('--text-muted',     '#6a6a78')
    root.style.setProperty('--text-faint',     '#9494a8')
    root.style.setProperty('--primary-600',    '#0d9488')
    root.style.setProperty('--primary-500',    '#14b8a6')
    root.style.setProperty('--primary-400',    '#2dd4bf')
    root.style.setProperty('--primary-700',    '#0f766e')
    root.style.setProperty('--primary-800',    '#115e59')
    root.style.setProperty('--glass-bg',       'rgba(255,255,255,0.92)')
    root.style.setProperty('--glass-border',   'rgba(0,0,0,0.10)')
    root.style.setProperty('--shadow-glow',    '0 0 20px rgba(13,148,136,0.15)')
    root.style.setProperty('--shadow-glow-lg', '0 0 40px rgba(13,148,136,0.22)')
    root.style.setProperty('--shadow-glass',   '0 8px 32px rgba(0,0,0,0.10)')
    root.style.setProperty('--shadow-card',    '0 4px 24px rgba(0,0,0,0.07)')
  } else {
    // ── Dark mode tokens ───────────────────────────────────────────
    root.style.setProperty('--bg-canvas',     '#0a0a0c')
    root.style.setProperty('--bg-sidebar',    '#0c0c0f')
    root.style.setProperty('--bg-card',       '#16161a')
    root.style.setProperty('--bg-card-hi',    '#1a1a1f')
    root.style.setProperty('--bg-hover',      'rgba(255,255,255,0.03)')
    root.style.setProperty('--bg-active',     'rgba(94,234,212,0.08)')

    root.style.setProperty('--border',        'rgba(255,255,255,0.06)')
    root.style.setProperty('--border-strong', 'rgba(255,255,255,0.10)')
    root.style.setProperty('--border-soft',   'rgba(255,255,255,0.04)')

    root.style.setProperty('--text-1', '#f1f1f4')
    root.style.setProperty('--text-2', '#c8c8d0')
    root.style.setProperty('--text-3', '#8a8a95')
    root.style.setProperty('--text-4', '#6b6b78')
    root.style.setProperty('--text-5', '#4a4a55')

    root.style.setProperty('--accent',      '#5eead4')
    root.style.setProperty('--accent-hi',   '#7df0dc')
    root.style.setProperty('--accent-bg',   'rgba(94,234,212,0.08)')
    root.style.setProperty('--accent-glow', 'rgba(94,234,212,0.18)')
    root.style.setProperty('--accent-ink',  '#04201d')

    root.style.setProperty('--status-active',   '#86efac')
    root.style.setProperty('--status-progress', '#93c5fd')
    root.style.setProperty('--status-planning', '#d0d0d8')
    root.style.setProperty('--status-hold',     '#fbbf24')
    root.style.setProperty('--status-done',     '#6ee7b7')
    root.style.setProperty('--status-error',    '#fca5a5')

    // Legacy + preset
    root.style.setProperty('--dark-900', preset.bg900)
    root.style.setProperty('--dark-800', preset.bg800)
    root.style.setProperty('--dark-700', preset.bg700)
    root.style.setProperty('--dark-600', preset.bg600)
    root.style.setProperty('--dark-500', '#2a2a35')
    root.style.setProperty('--text-primary',   '#f1f1f4')
    root.style.setProperty('--text-secondary', '#c8c8d0')
    root.style.setProperty('--text-muted',     '#8a8a95')
    root.style.setProperty('--text-faint',     '#6b6b78')

    const accent = settings.accentKey
      ? QUICK_ACCENTS.find((a) => a.key === settings.accentKey) ?? null
      : null
    const p600 = accent?.p600 ?? preset.p600
    const p500 = accent?.p500 ?? preset.p500
    const p400 = accent?.p400 ?? preset.p400
    const p700 = accent?.p700 ?? preset.p700
    const p800 = accent?.p800 ?? preset.p800
    const rgb  = accent?.rgb  ?? preset.glowRgb

    root.style.setProperty('--primary-600', p600)
    root.style.setProperty('--primary-500', p500)
    root.style.setProperty('--primary-400', p400)
    root.style.setProperty('--primary-700', p700)
    root.style.setProperty('--primary-800', p800)

    // Parse bg800 hex -> RGB string for glass-bg
    const bg8 = preset.bg800.replace('#', '').match(/../g)!.map((h) => parseInt(h, 16)).join(',')
    root.style.setProperty('--glass-bg',       `rgba(${bg8},0.8)`)
    root.style.setProperty('--glass-border',   `rgba(${rgb},0.2)`)
    root.style.setProperty('--shadow-glow',    `0 0 20px rgba(${rgb},0.4)`)
    root.style.setProperty('--shadow-glow-lg', `0 0 40px rgba(${rgb},0.5)`)
    root.style.setProperty('--shadow-glass',   '0 8px 32px rgba(0,0,0,0.5)')
    root.style.setProperty('--shadow-card',    '0 4px 24px rgba(0,0,0,0.4)')
  }

  // Density
  root.classList.remove('density-compact', 'density-regular', 'density-comfy')
  if (settings.density !== 'regular') root.classList.add(`density-${settings.density}`)
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(load)

  useEffect(() => { applyTheme(settings) }, [settings])

  const update = useCallback((patch: Partial<ThemeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      save(next)
      return next
    })
  }, [])

  return (
    <ThemeSettingsContext.Provider value={{
      ...settings,
      setDensity:   (density)   => update({ density }),
      setPreset:    (preset)    => update({ preset, accentKey: null }),
      setAccentKey: (accentKey) => update({ accentKey }),
      setMode:      (mode)      => update({ mode }),
      toggleMode:   ()          => update({ mode: settings.mode === 'light' ? 'dark' : 'light' }),
    }}>
      {children}
    </ThemeSettingsContext.Provider>
  )
}

export function useThemeSettings() {
  return useContext(ThemeSettingsContext)
}
