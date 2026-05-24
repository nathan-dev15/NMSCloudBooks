import { useState, useCallback } from 'react'
import type {
  FilterField, FilterCondition, FilterLogic, ActiveFilters, FilterPreset, FilterOperator,
} from './filterTypes'
import { OPERATOR_LABELS, DEFAULT_OPERATORS } from './filterTypes'
import Button from '../Button'

let _id = 0
const nextId = () => String(++_id)

const normalizeOptions = (options: FilterField['options'] = []) =>
  options.map((option) => typeof option === 'string' ? { label: option, value: option } : option)

const darkSelectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(12,122,130,0.2)',
  borderRadius: '10px',
  padding: '6px 10px',
  fontSize: '13px',
  color: 'var(--text-secondary)',
  outline: 'none',
}

const darkInputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(12,122,130,0.2)',
  borderRadius: '10px',
  padding: '6px 10px',
  fontSize: '13px',
  color: 'var(--text-secondary)',
  outline: 'none',
  width: '100%',
}

function ValueInput({
  condition,
  field,
  onChange,
}: {
  condition: FilterCondition
  field: FilterField | undefined
  onChange: (value: FilterCondition['value']) => void
}) {
  if (!field) return null
  const noValueOps: FilterOperator[] = ['is_empty', 'is_not_empty']
  if (noValueOps.includes(condition.operator)) return null

  if (condition.operator === 'between') {
    const [from, to] = (condition.value as [string, string]) ?? ['', '']
    return (
      <div className="flex items-center gap-1 flex-1">
        <input
          type={field.type === 'number' ? 'number' : 'date'}
          value={from}
          onChange={(e) => onChange([e.target.value, to])}
          style={{ ...darkInputStyle, flex: 1 }}
        />
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>to</span>
        <input
          type={field.type === 'number' ? 'number' : 'date'}
          value={to}
          onChange={(e) => onChange([from, e.target.value])}
          style={{ ...darkInputStyle, flex: 1 }}
        />
      </div>
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <select
        value={String(condition.value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...darkSelectStyle, flex: 1 }}
      >
        <option value="" style={{ background: 'var(--dark-700)' }}>Select…</option>
        {normalizeOptions(field.options).map((o) => (
          <option key={o.value} value={o.value} style={{ background: 'var(--dark-700)' }}>{o.label}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'multi_select' && field.options) {
    const selected = (condition.value as string[] | null) ?? []
    return (
      <div className="flex flex-wrap gap-1 flex-1">
        {normalizeOptions(field.options).map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              const next = selected.includes(o.value)
                ? selected.filter((v) => v !== o.value)
                : [...selected, o.value]
              onChange(next)
            }}
            className="px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-150"
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
  }

  if (field.type === 'boolean') {
    return (
      <select
        value={String(condition.value ?? 'true')}
        onChange={(e) => onChange(e.target.value === 'true')}
        style={{ ...darkSelectStyle, flex: 1 }}
      >
        <option value="true" style={{ background: 'var(--dark-700)' }}>True</option>
        <option value="false" style={{ background: 'var(--dark-700)' }}>False</option>
      </select>
    )
  }

  return (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      value={String(condition.value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? 'Value…'}
      style={{ ...darkInputStyle, flex: 1 }}
    />
  )
}

function ConditionRow({
  condition, fields, index, totalRows, logic, onLogicToggle, onChange, onRemove,
}: {
  condition: FilterCondition
  fields: FilterField[]
  index: number
  totalRows: number
  logic: FilterLogic
  onLogicToggle: () => void
  onChange: (cond: FilterCondition) => void
  onRemove: () => void
}) {
  const field = fields.find((f) => f.key === condition.field)
  const operators = field ? (field.operators ?? DEFAULT_OPERATORS[field.type]) : []

  const handleFieldChange = (key: string) => {
    const f = fields.find((x) => x.key === key)
    const ops = f ? (f.operators ?? DEFAULT_OPERATORS[f.type]) : []
    onChange({ ...condition, field: key, operator: ops[0], value: null })
  }

  const handleOperatorChange = (op: FilterOperator) => {
    onChange({ ...condition, operator: op, value: null })
  }

  return (
    <div
      className="flex items-start gap-2 py-2.5"
      style={{ borderBottom: '1px solid rgba(12,122,130,0.08)' }}
    >
      {/* AND/OR label */}
      <div className="w-14 flex-shrink-0 flex items-center justify-center mt-1">
        {index === 0 ? (
          <span className="text-xs font-semibold" style={{ color: 'var(--text-faint)' }}>WHERE</span>
        ) : (
          <button
            type="button"
            onClick={onLogicToggle}
            className="text-xs font-bold px-2 py-0.5 rounded transition-all duration-150"
            style={{
              color: 'var(--primary-400)',
              border: '1px solid rgba(12,122,130,0.3)',
              background: 'rgba(12,122,130,0.1)',
            }}
          >
            {logic}
          </button>
        )}
      </div>

      {/* Field */}
      <select
        value={condition.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        style={{ ...darkSelectStyle, width: '140px', flexShrink: 0 }}
      >
        <option value="" style={{ background: 'var(--dark-700)' }}>Field…</option>
        {fields.map((f) => (
          <option key={f.key} value={f.key} style={{ background: 'var(--dark-700)' }}>{f.label}</option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
        style={{ ...darkSelectStyle, width: '140px', flexShrink: 0 }}
      >
        {operators.map((op) => (
          <option key={op} value={op} style={{ background: 'var(--dark-700)' }}>{OPERATOR_LABELS[op]}</option>
        ))}
      </select>

      {/* Value */}
      <ValueInput
        condition={condition}
        field={field}
        onChange={(v) => onChange({ ...condition, value: v })}
      />

      {/* Remove */}
      {totalRows > 1 && (
        <button
          onClick={onRemove}
          aria-label="Remove condition"
          className="flex-shrink-0 mt-1 transition-colors duration-150"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff6b35' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

export interface AdvancedFilterProps {
  fields: FilterField[]
  value: ActiveFilters
  onChange: (filters: ActiveFilters) => void
  presets?: FilterPreset[]
  onSavePreset?: (preset: Omit<FilterPreset, 'id'>) => void
  onDeletePreset?: (id: string) => void
  className?: string
}

export default function AdvancedFilter({
  fields, value, onChange, presets = [], onSavePreset, onDeletePreset, className,
}: AdvancedFilterProps) {
  const [open, setOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [showSavePreset, setShowSavePreset] = useState(false)

  const { conditions, logic } = value
  const activeCount = conditions.filter((c) => c.field && c.value !== null && c.value !== '').length

  const update = useCallback((next: ActiveFilters) => onChange(next), [onChange])

  const addCondition = () => {
    const first = fields[0]
    const op = first ? (first.operators ?? DEFAULT_OPERATORS[first.type])[0] : 'contains'
    update({
      ...value,
      conditions: [...conditions, { id: nextId(), field: first?.key ?? '', operator: op, value: null }],
    })
  }

  const removeCondition = (id: string) =>
    update({ ...value, conditions: conditions.filter((c) => c.id !== id) })

  const updateCondition = (updated: FilterCondition) =>
    update({ ...value, conditions: conditions.map((c) => (c.id === updated.id ? updated : c)) })

  const toggleLogic = () => update({ ...value, logic: logic === 'AND' ? 'OR' : 'AND' })
  const clearAll = () => update({ conditions: [], logic: 'AND' })

  const applyPreset = (preset: FilterPreset) =>
    update({ conditions: preset.conditions.map((c) => ({ ...c, id: nextId() })), logic: preset.logic })

  const savePreset = () => {
    if (!presetName.trim()) return
    onSavePreset?.({ name: presetName.trim(), conditions, logic })
    setPresetName('')
    setShowSavePreset(false)
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <Button
        size="sm"
        variant={activeCount > 0 ? 'primary' : 'outline'}
        onClick={() => setOpen(!open)}
        leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
          </svg>
        }
      >
        Filters
        {activeCount > 0 && (
          <span
            className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
          >
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 z-30 mt-2 w-[640px] max-w-[95vw] rounded-2xl animate-slide-up"
            style={{
              background: 'var(--dark-700)',
              border: '1px solid rgba(12,122,130,0.25)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(12,122,130,0.1)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-1 h-5 rounded-full"
                  style={{ background: 'linear-gradient(180deg, #0c7a82 0%, #00d4ff 100%)' }}
                />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Advanced Filters
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {activeCount > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs font-medium transition-colors duration-150"
                    style={{ color: '#ff6b35' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="transition-colors duration-150"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Presets */}
            {presets.length > 0 && (
              <div
                className="px-5 py-3 flex flex-wrap gap-2"
                style={{ borderBottom: '1px solid rgba(12,122,130,0.1)' }}
              >
                <span className="text-xs self-center" style={{ color: 'var(--text-faint)' }}>Saved:</span>
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <button
                      onClick={() => applyPreset(p)}
                      className="text-xs px-2.5 py-1 rounded-full transition-all duration-150"
                      style={{
                        background: 'rgba(12,122,130,0.1)',
                        color: 'var(--primary-400)',
                        border: '1px solid rgba(12,122,130,0.2)',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.2)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.1)' }}
                    >
                      {p.name}
                    </button>
                    {onDeletePreset && (
                      <button
                        onClick={() => onDeletePreset(p.id)}
                        className="transition-colors duration-150"
                        style={{ color: 'var(--text-faint)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff6b35' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint)' }}
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 8.586 3.293 1.879 1.879 3.293 8.586 10l-6.707 6.707 1.414 1.414L10 11.414l6.707 6.707 1.414-1.414L11.414 10l6.707-6.707-1.414-1.414L10 8.586Z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Conditions */}
            <div className="px-5 py-3 max-h-64 overflow-y-auto">
              {conditions.length === 0 ? (
                <p className="text-sm py-3" style={{ color: 'var(--text-faint)' }}>
                  No filters yet. Add a condition below.
                </p>
              ) : (
                conditions.map((cond, idx) => (
                  <ConditionRow
                    key={cond.id}
                    condition={cond}
                    fields={fields}
                    index={idx}
                    totalRows={conditions.length}
                    logic={logic}
                    onLogicToggle={toggleLogic}
                    onChange={updateCondition}
                    onRemove={() => removeCondition(cond.id)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap"
              style={{ borderTop: '1px solid rgba(12,122,130,0.12)' }}
            >
              <Button
                size="sm"
                variant="ghost"
                onClick={addCondition}
                leftIcon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                }
              >
                Add condition
              </Button>

              <div className="flex items-center gap-2">
                {onSavePreset && activeCount > 0 && (
                  showSavePreset ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="Preset name…"
                        onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                        autoFocus
                        style={{
                          ...darkInputStyle,
                          width: '140px',
                          padding: '5px 10px',
                        }}
                      />
                      <Button size="sm" variant="primary" onClick={savePreset}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowSavePreset(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setShowSavePreset(true)}>
                      Save preset
                    </Button>
                  )
                )}
                <Button size="sm" variant="primary" onClick={() => setOpen(false)}>Apply</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
