import { useState, useCallback, useEffect, FormEvent } from 'react'
import { clsx } from 'clsx'
import type { FieldDef, GenericFormProps, SelectOption } from './formTypes'
import Button from '../Button'
import Spinner from '../Spinner'

// ─── Built-in validators ───────────────────────────────────────────────────────

function runValidators(field: FieldDef, value: unknown, all: Record<string, unknown>): string | null {
  if (field.type === 'divider' || field.type === 'heading') return null

  const str = String(value ?? '')
  if (field.required && (value === null || value === undefined || str === '' || (Array.isArray(value) && value.length === 0))) {
    return `${field.label ?? field.key} is required`
  }
  if (!str && !field.required) return null

  if (field.minLength && str.length < field.minLength) return `Minimum ${field.minLength} characters`
  if (field.maxLength && str.length > field.maxLength) return `Maximum ${field.maxLength} characters`
  if (field.type === 'number' || field.type === 'text') {
    const num = Number(str)
    if (field.type === 'number' && isNaN(num)) return 'Must be a number'
    if (field.min !== undefined && num < Number(field.min)) return `Minimum value is ${field.min}`
    if (field.max !== undefined && num > Number(field.max)) return `Maximum value is ${field.max}`
  }
  if (field.pattern && !field.pattern.test(str)) return 'Invalid format'
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return 'Invalid email address'

  for (const v of field.validators ?? []) {
    const err = v(value, all)
    if (err) return err
  }

  return null
}

const normalizeOptions = (options: FieldDef['options'] = []): SelectOption[] =>
  options.map((option) => typeof option === 'string' ? { label: option, value: option } : option)

// ─── FileInput ─────────────────────────────────────────────────────────────────

function FileInput({
  field, value, onChange, error,
}: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; error?: string }) {
  const [progress] = useState<number | null>(null)
  const files = value instanceof FileList ? Array.from(value) : []

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files
    if (!fl) return
    if (field.maxSizeMb) {
      for (const f of Array.from(fl)) {
        if (f.size > field.maxSizeMb * 1024 * 1024) {
          alert(`${f.name} exceeds the ${field.maxSizeMb}MB size limit`)
          return
        }
      }
    }
    onChange(fl)
  }

  return (
    <div className="flex-1">
      <label
        className="flex flex-col items-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all duration-200"
        style={{
          borderColor: error ? 'rgba(255,107,53,0.4)' : 'rgba(12,122,130,0.25)',
          background: error ? 'rgba(255,107,53,0.05)' : 'rgba(12,122,130,0.04)',
        }}
        onMouseEnter={(e) => {
          if (!error) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(12,122,130,0.5)'
        }}
        onMouseLeave={(e) => {
          if (!error) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(12,122,130,0.25)'
        }}
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary-500)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {files.length > 0
            ? files.map((f) => f.name).join(', ')
            : field.placeholder ?? 'Click to upload or drag & drop'}
        </span>
        {field.maxSizeMb && (
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Max {field.maxSizeMb}MB</span>
        )}
        <input type="file" accept={field.accept} multiple={field.multiple} onChange={handleChange} className="hidden" />
      </label>
      {progress !== null && (
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(12,122,130,0.15)' }}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #0c7a82, #00d4ff)' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── AsyncSelect ───────────────────────────────────────────────────────────────

function AsyncSelect({
  field, value, onChange,
}: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const [options, setOptions] = useState<SelectOption[]>(normalizeOptions(field.options))
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async (q: string) => {
    if (!field.loadOptions) return
    setLoading(true)
    const res = await field.loadOptions(q)
    setOptions(res)
    setLoading(false)
  }, [field])

  useEffect(() => { if (field.loadOptions) load('') }, [load, field.loadOptions])

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); load(e.target.value) }}
        placeholder="Search options…"
        className="input-dark w-full rounded-b-none"
        style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
      />
      <div
        className="max-h-40 overflow-y-auto"
        style={{
          background: 'var(--dark-700)',
          border: '1px solid rgba(12,122,130,0.2)',
          borderTop: 'none',
          borderBottomLeftRadius: '10px',
          borderBottomRightRadius: '10px',
        }}
      >
        {loading && <div className="flex justify-center py-3"><Spinner size="sm" className="text-primary-500" /></div>}
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className="w-full text-left px-3 py-2 text-sm transition-colors duration-100 disabled:opacity-40"
            style={{
              color: value === o.value ? 'var(--primary-400)' : 'var(--text-secondary)',
              background: value === o.value ? 'rgba(12,122,130,0.12)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (value !== o.value) (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.06)'
            }}
            onMouseLeave={(e) => {
              if (value !== o.value) (e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── FieldRenderer ─────────────────────────────────────────────────────────────

function FieldRenderer({
  field, value, onChange, error, allValues,
}: {
  field: FieldDef
  value: unknown
  onChange: (key: string, v: unknown) => void
  error?: string
  allValues: Record<string, unknown>
}) {
  if (field.showWhen && !field.showWhen(allValues)) return null

  if (field.type === 'divider') {
    return (
      <hr
        className="col-span-full my-1"
        style={{ borderColor: 'rgba(12,122,130,0.15)' }}
      />
    )
  }

  if (field.type === 'heading') {
    return (
      <div className="col-span-full">
        <div className="flex items-center gap-2 mt-2">
          <div
            className="w-0.5 h-4 rounded-full"
            style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }}
          />
          <h4 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {field.text ?? field.key}
          </h4>
        </div>
      </div>
    )
  }

  if (field.type === 'hidden') {
    return <input type="hidden" name={field.key} value={String(value ?? '')} />
  }

  const darkInputCls = `input-dark w-full ${field.disabled ? 'opacity-50 cursor-not-allowed' : ''}`
  const errorBorderStyle = error
    ? { borderColor: 'rgba(255,107,53,0.5)', boxShadow: '0 0 0 3px rgba(255,107,53,0.08)' }
    : {}

  const labelEl = field.label && (
    <label className="block text-xs font-semibold mb-1.5 tracking-wide" style={{ color: 'var(--text-muted)' }}>
      {field.label}
      {field.required && <span className="ml-0.5" style={{ color: '#ff6b35' }}>*</span>}
      {field.labelSuffix && <span className="ml-1" style={{ color: 'var(--text-faint)' }}>{field.labelSuffix}</span>}
    </label>
  )

  let input: React.ReactNode

  switch (field.type) {
    case 'textarea':
      input = (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={field.disabled}
          rows={4}
          className={`${darkInputCls} resize-y`}
          style={errorBorderStyle}
        />
      )
      break

    case 'select':
      input = field.loadOptions
        ? <AsyncSelect field={field} value={value} onChange={(v) => onChange(field.key, v)} />
        : (
          <div className="relative">
            <select
              value={String(value ?? '')}
              onChange={(e) => onChange(field.key, e.target.value)}
              disabled={field.disabled}
              className={`${darkInputCls} appearance-none pr-8`}
              style={errorBorderStyle}
            >
              <option value="" style={{ background: 'var(--dark-800)' }}>
                {field.placeholder ?? `Select ${field.label ?? field.key}…`}
              </option>
              {normalizeOptions(field.options).map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled} style={{ background: 'var(--dark-800)' }}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )
      break

    case 'multi-select': {
      const selected: string[] = Array.isArray(value) ? (value as string[]) : []
      input = (
        <div className="flex flex-wrap gap-2">
          {normalizeOptions(field.options).map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={field.disabled}
              onClick={() => {
                const next = selected.includes(o.value)
                  ? selected.filter((v) => v !== o.value)
                  : [...selected, o.value]
                onChange(field.key, next)
              }}
              className="px-3 py-1 rounded-full text-sm font-medium transition-all duration-150 disabled:opacity-50"
              style={selected.includes(o.value) ? {
                background: 'rgba(12,122,130,0.25)',
                color: 'var(--primary-400)',
                border: '1px solid rgba(12,122,130,0.5)',
              } : {
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-muted)',
                border: '1px solid rgba(12,122,130,0.15)',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )
      break
    }

    case 'checkbox':
      return (
        <label
          className={clsx('flex items-center gap-3 cursor-pointer select-none', field.disabled && 'opacity-60 cursor-not-allowed')}
        >
          <div className="relative">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(field.key, e.target.checked)}
              disabled={field.disabled}
              className="sr-only"
            />
            <div
              className="w-4 h-4 rounded flex items-center justify-center transition-all duration-150"
              style={{
                background: Boolean(value) ? 'linear-gradient(135deg, #0c7a82, #0e949e)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${Boolean(value) ? '#0c7a82' : 'rgba(12,122,130,0.3)'}`,
              }}
            >
              {Boolean(value) && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </div>
          </div>
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{field.label}</span>
            {field.hint && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{field.hint}</p>
            )}
          </div>
        </label>
      )

    case 'radio':
      return (
        <div className={clsx('space-y-2', field.className)}>
          {field.label && (
            <p className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {field.label}
              {field.required && <span className="ml-0.5" style={{ color: '#ff6b35' }}>*</span>}
            </p>
          )}
          {normalizeOptions(field.options).map((o) => (
            <label key={o.value} className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="radio"
                  value={o.value}
                  checked={value === o.value}
                  onChange={() => onChange(field.key, o.value)}
                  disabled={field.disabled || o.disabled}
                  className="sr-only"
                />
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center transition-all duration-150"
                  style={{
                    border: `1px solid ${value === o.value ? '#0c7a82' : 'rgba(12,122,130,0.3)'}`,
                    background: value === o.value ? 'rgba(12,122,130,0.1)' : 'transparent',
                  }}
                >
                  {value === o.value && (
                    <div className="w-2 h-2 rounded-full" style={{ background: '#0c7a82' }} />
                  )}
                </div>
              </div>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{o.label}</span>
            </label>
          ))}
          {error && (
            <p className="text-xs font-medium" style={{ color: '#ff6b35' }}>{error}</p>
          )}
        </div>
      )

    case 'file':
      input = <FileInput field={field} value={value} onChange={(v) => onChange(field.key, v)} error={error} />
      break

    default:
      input = (
        <input
          type={field.type}
          value={String(value ?? '')}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          disabled={field.disabled}
          min={field.min as string}
          max={field.max as string}
          minLength={field.minLength}
          maxLength={field.maxLength}
          className={darkInputCls}
          style={errorBorderStyle}
        />
      )
  }

  return (
    <div className={clsx('flex flex-col', field.colSpan === 2 && 'col-span-2', field.colSpan === 3 && 'col-span-3', field.className)}>
      {labelEl}
      {input}
      {error && (
        <p className="mt-1.5 text-xs font-medium flex items-center gap-1" style={{ color: '#ff6b35' }}>
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {!error && field.hint && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-faint)' }}>{field.hint}</p>
      )}
    </div>
  )
}

// ─── GenericForm ───────────────────────────────────────────────────────────────

export default function GenericForm({
  fields,
  sections,
  values,
  initialValues,
  onChange,
  errors: externalErrors,
  onErrorsChange,
  onSubmit,
  submitLabel = 'Save',
  loading = false,
  columns = 1,
  className,
  onCancel,
  cancelLabel = 'Cancel',
  formId,
  noSubmitButton = false,
}: GenericFormProps) {
  const [internalValues, setInternalValues] = useState<Record<string, unknown>>((initialValues ?? {}) as Record<string, unknown>)
  const [internalErrors, setInternalErrors] = useState<Record<string, string>>({})
  const formValues = values ?? internalValues
  const errors = externalErrors ?? internalErrors

  const allFields = fields ?? sections?.flatMap((s) => s.fields) ?? []

  const setFieldValue = useCallback((key: string, val: unknown) => {
    const next = { ...formValues, [key]: val }
    if (onChange) onChange(next)
    if (!values) setInternalValues(next)
    if (errors[key]) {
      const next = { ...errors }
      delete next[key]
      onErrorsChange ? onErrorsChange(next) : setInternalErrors(next)
    }
  }, [formValues, onChange, values, errors, onErrorsChange])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    for (const field of allFields) {
      if (field.showWhen && !field.showWhen(formValues)) continue
      const err = runValidators(field, formValues[field.key], formValues)
      if (err) errs[field.key] = err
    }
    onErrorsChange ? onErrorsChange(errs) : setInternalErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    await onSubmit?.(formValues)
  }

  const gridClass = clsx(
    'grid gap-4',
    columns === 2 && 'grid-cols-2',
    columns === 3 && 'grid-cols-3',
  )

  const renderFields = (fieldList: FieldDef[]) => (
    <div className={gridClass}>
      {fieldList.map((f) => (
        <FieldRenderer
          key={f.key}
          field={f}
          value={formValues[f.key] ?? f.defaultValue ?? ''}
          onChange={setFieldValue}
          error={errors[f.key]}
          allValues={formValues}
        />
      ))}
    </div>
  )

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className={clsx('space-y-5', className)}>
      {sections
        ? sections.map((section, i) => (
            <div key={i} className="space-y-4">
              {section.title && (
                <div className="pb-3" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-0.5 h-4 rounded-full"
                      style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }}
                    />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {section.title}
                    </h3>
                  </div>
                  {section.description && (
                    <p className="text-xs mt-1 ml-2.5" style={{ color: 'var(--text-faint)' }}>
                      {section.description}
                    </p>
                  )}
                </div>
              )}
              {renderFields(section.fields)}
            </div>
          ))
        : renderFields(allFields)}

      {!noSubmitButton && (
        <div className="flex items-center justify-end gap-3 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          )}
          <Button type="submit" variant="primary" loading={loading}>{submitLabel}</Button>
        </div>
      )}
    </form>
  )
}
