import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { label: string; value: string }[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label, error, options, className, id, placeholder, style, ...props
}, ref) => {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold mb-1.5 tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
          {props.required && (
            <span className="ml-1" style={{ color: '#ff6b35' }}>*</span>
          )}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`input-dark w-full appearance-none pr-9 ${className ?? ''}`}
          style={{
            borderColor: error ? 'rgba(255,107,53,0.5)' : undefined,
            boxShadow: error ? '0 0 0 3px rgba(255,107,53,0.08)' : undefined,
            ...style,
          }}
          {...props}
        >
          {placeholder && (
            <option value="" style={{ background: 'var(--dark-800)', color: 'var(--text-muted)' }}>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option
              key={o.value}
              value={o.value}
              style={{ background: 'var(--dark-800)', color: 'var(--text-primary)' }}
            >
              {o.label}
            </option>
          ))}
        </select>
        {/* Custom chevron */}
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium flex items-center gap-1" style={{ color: '#ff6b35' }}>
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
})
Select.displayName = 'Select'
export default Select
