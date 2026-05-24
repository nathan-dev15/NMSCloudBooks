import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Density   = 'compact' | 'regular' | 'comfy'
export type PresetKey = 'midnight-teal' | 'crimson' | 'deep-purple' | 'ocean-blue' | 'forest' | 'obsidian'

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
    bg900: '#0a0e17', bg800: '#10151f', bg700: '#1a2332', bg600: '#243044',
    p600:  '#0c7a82', p500:  '#0e949e', p400:  '#2aacb5', p700:  '#0a6269', p800: '#094d56',
    glowRgb: '12,122,130',
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
  density:       Density
  preset:        PresetKey
  accentKey:     string | null
}

interface ThemeSettingsCtx extends ThemeSettings {
  setDensity:    (d: Density) => void
  setPreset:     (p: PresetKey) => void
  setAccentKey:  (k: string | null) => void
}

const ThemeSettingsContext = createContext<ThemeSettingsCtx>({} as ThemeSettingsCtx)

// ── Helpers ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'nms_theme_settings'

function load(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { density: 'regular', preset: 'midnight-teal', accentKey: null }
}

function save(s: ThemeSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

function applyTheme(settings: ThemeSettings) {
  const root = document.documentElement
  const preset = PRESETS[settings.preset]

  // Background tokens
  root.style.setProperty('--dark-900', preset.bg900)
  root.style.setProperty('--dark-800', preset.bg800)
  root.style.setProperty('--dark-700', preset.bg700)
  root.style.setProperty('--dark-600', preset.bg600)

  // Primary accent — either quick accent override or preset default
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

  // Derived tokens
  root.style.setProperty('--glass-border', `rgba(${rgb},0.2)`)
  root.style.setProperty('--glass-bg', `rgba(${preset.bg800.replace('#', '').match(/../g)!.map(h => parseInt(h,16)).join(',')},0.7)`)
  root.style.setProperty('--shadow-glow', `0 0 20px rgba(${rgb},0.4)`)
  root.style.setProperty('--shadow-glow-lg', `0 0 40px rgba(${rgb},0.5)`)

  // Density — apply via font-size on root
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
    }}>
      {children}
    </ThemeSettingsContext.Provider>
  )
}

export function useThemeSettings() {
  return useContext(ThemeSettingsContext)
}
