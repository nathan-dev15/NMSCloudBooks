import { useState, useRef, useEffect, useCallback } from 'react'
import Spinner from '../Spinner'

export interface SearchSuggestion {
  label: string
  value: string
  meta?: string
}

export interface SingleSearchProps {
  value: string
  onChange: (value: string) => void
  onSearch?: (value: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
  suggestions?: SearchSuggestion[]
  onSuggestionsFetch?: (query: string) => void | Promise<void>
  suggestionsLoading?: boolean
  onSuggestionSelect?: (s: SearchSuggestion) => void
  storageKey?: string
  debounceMs?: number
  highlightMatch?: boolean
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(0,212,255,0.2)', color: '#00d4ff', borderRadius: '2px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function getRecent(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] }
}

function saveRecent(key: string, value: string): void {
  const prev = getRecent(key).filter((v) => v !== value)
  localStorage.setItem(key, JSON.stringify([value, ...prev].slice(0, 8)))
}

export default function SingleSearch({
  value,
  onChange,
  onSearch,
  placeholder = 'Search…',
  label,
  disabled,
  className,
  suggestions = [],
  onSuggestionsFetch,
  suggestionsLoading,
  onSuggestionSelect,
  storageKey,
  debounceMs = 300,
  highlightMatch = true,
}: SingleSearchProps) {
  const [focused, setFocused] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const recentSearches = storageKey ? getRecent(storageKey) : []

  useEffect(() => { setLocalValue(value) }, [value])

  const handleChange = useCallback((raw: string) => {
    setLocalValue(raw)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange(raw)
      onSuggestionsFetch?.(raw)
    }, debounceMs)
  }, [onChange, onSuggestionsFetch, debounceMs])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      clearTimeout(debounceRef.current)
      onChange(localValue)
      onSearch?.(localValue)
      if (storageKey && localValue.trim()) saveRecent(storageKey, localValue.trim())
      setFocused(false)
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') { setFocused(false); inputRef.current?.blur() }
  }

  const handleClear = () => { setLocalValue(''); onChange(''); onSearch?.('') }

  const showDropdown = focused && (suggestions.length > 0 || recentSearches.length > 0 || suggestionsLoading)

  return (
    <div className={`relative w-full ${className ?? ''}`}>
      {label && (
        <label
          className="block text-xs font-semibold mb-1.5 tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </label>
      )}

      <div
        className="flex items-center gap-2 rounded-xl transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: focused
            ? '1px solid rgba(12,122,130,0.6)'
            : '1px solid rgba(12,122,130,0.2)',
          boxShadow: focused ? '0 0 0 3px rgba(12,122,130,0.1)' : 'none',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <svg
          className="w-4 h-4 ml-3 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: focused ? 'var(--primary-400)' : 'var(--text-muted)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={localValue}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
          className="flex-1 py-2.5 pr-2 bg-transparent text-sm focus:outline-none"
          style={{
            color: 'var(--text-primary)',
          }}
        />

        {suggestionsLoading && <Spinner size="sm" className="text-primary-500 mr-2" />}

        {localValue && !disabled && (
          <button
            onClick={handleClear}
            aria-label="Clear"
            className="mr-3 transition-colors duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff6b35' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 8.586 3.293 1.879 1.879 3.293 8.586 10l-6.707 6.707 1.414 1.414L10 11.414l6.707 6.707 1.414-1.414L11.414 10l6.707-6.707-1.414-1.414L10 8.586Z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute left-0 right-0 z-30 mt-1.5 rounded-xl max-h-60 overflow-y-auto"
          style={{
            background: 'var(--dark-700)',
            border: '1px solid rgba(12,122,130,0.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {suggestionsLoading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Spinner size="sm" className="text-primary-500" /> Searching…
            </div>
          )}

          {!suggestionsLoading && suggestions.length > 0 && (
            <div>
              <p
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-faint)' }}
              >
                Suggestions
              </p>
              {suggestions.map((s) => (
                <button
                  key={s.value}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors duration-100"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.1)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  onMouseDown={() => {
                    setLocalValue(s.label)
                    onChange(s.value)
                    onSuggestionSelect?.(s)
                    if (storageKey) saveRecent(storageKey, s.label)
                  }}
                >
                  <span>{highlightMatch ? highlight(s.label, localValue) : s.label}</span>
                  {s.meta && (
                    <span className="text-xs ml-2" style={{ color: 'var(--text-faint)' }}>{s.meta}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {!suggestionsLoading && recentSearches.length > 0 && suggestions.length === 0 && (
            <div>
              <p
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-faint)' }}
              >
                Recent
              </p>
              {recentSearches.map((r) => (
                <button
                  key={r}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors duration-100"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.08)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  onMouseDown={() => { setLocalValue(r); onChange(r); onSearch?.(r) }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-faint)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
