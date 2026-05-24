import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, hint, className, id, style, ...props
}, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold mb-1.5 tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
          {props.required && (
            <span className="ml-1" style={{ color: '#ff6b35' }}>*</span>
          )}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`input-dark ${className ?? ''}`}
        style={{
          borderColor: error ? 'rgba(255,107,53,0.5)' : undefined,
          boxShadow: error ? '0 0 0 3px rgba(255,107,53,0.08)' : undefined,
          ...style,
        }}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs font-medium flex items-center gap-1" style={{ color: '#ff6b35' }}>
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-faint)' }}>{hint}</p>
      )}
    </div>
  )
})
Input.displayName = 'Input'
export default Input
