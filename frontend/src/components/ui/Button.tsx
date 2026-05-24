import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import Spinner from './Spinner'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'gradient' | 'cyan' | 'purple' | 'success'
type Size    = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: React.ReactNode
  glow?: boolean
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #0c7a82 0%, #0e949e 100%)',
    color: '#fff',
    border: '1px solid rgba(12,122,130,0.5)',
    boxShadow: '0 0 16px rgba(12,122,130,0.3)',
  },
  gradient: {
    background: 'linear-gradient(135deg, #0c7a82 0%, #00d4ff 100%)',
    color: '#fff',
    border: '1px solid rgba(0,212,255,0.3)',
    boxShadow: '0 0 20px rgba(12,122,130,0.4)',
  },
  cyan: {
    background: 'rgba(0, 212, 255, 0.12)',
    color: '#00d4ff',
    border: '1px solid rgba(0, 212, 255, 0.3)',
  },
  purple: {
    background: 'rgba(157, 78, 221, 0.12)',
    color: '#9d4edd',
    border: '1px solid rgba(157, 78, 221, 0.3)',
  },
  success: {
    background: 'linear-gradient(135deg, #06d6a0 0%, #0c7a82 100%)',
    color: '#fff',
    border: '1px solid rgba(6,214,160,0.3)',
    boxShadow: '0 0 16px rgba(6,214,160,0.25)',
  },
  secondary: {
    background: 'rgba(26, 35, 50, 0.8)',
    color: 'var(--text-muted)',
    border: '1px solid rgba(12,122,130,0.2)',
  },
  danger: {
    background: 'rgba(255, 107, 53, 0.12)',
    color: '#ff6b35',
    border: '1px solid rgba(255, 107, 53, 0.3)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid transparent',
  },
  outline: {
    background: 'transparent',
    color: 'var(--primary-400)',
    border: '1px solid rgba(12,122,130,0.4)',
  },
}

const hoverStyles: Record<Variant, React.CSSProperties> = {
  primary:   { boxShadow: '0 0 24px rgba(12,122,130,0.5)', filter: 'brightness(1.08)' },
  gradient:  { boxShadow: '0 0 28px rgba(12,122,130,0.6)', filter: 'brightness(1.05)' },
  cyan:      { background: 'rgba(0,212,255,0.2)',  boxShadow: '0 0 16px rgba(0,212,255,0.3)' },
  purple:    { background: 'rgba(157,78,221,0.2)', boxShadow: '0 0 16px rgba(157,78,221,0.3)' },
  success:   { boxShadow: '0 0 24px rgba(6,214,160,0.4)', filter: 'brightness(1.05)' },
  secondary: { background: 'rgba(36,48,68,0.9)',  borderColor: 'rgba(12,122,130,0.35)', color: 'var(--text-primary)' },
  danger:    { background: 'rgba(255,107,53,0.22)', boxShadow: '0 0 16px rgba(255,107,53,0.25)' },
  ghost:     { background: 'rgba(12,122,130,0.08)', color: 'var(--text-primary)' },
  outline:   { background: 'rgba(12,122,130,0.08)', borderColor: 'rgba(12,122,130,0.6)', color: 'var(--primary-300)' },
}

const sizes: Record<Size, string> = {
  xs: 'px-2.5 py-1 text-[11px]',
  sm: 'px-3   py-1.5 text-xs',
  md: 'px-4   py-2   text-sm',
  lg: 'px-5   py-2.5 text-sm',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size    = 'md',
  loading = false,
  leftIcon,
  children,
  className,
  disabled,
  glow,
  style,
  onMouseEnter,
  onMouseLeave,
  ...props
}, ref) => {
  const base = variantStyles[variant]
  const hover = hoverStyles[variant]

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center gap-2 font-semibold rounded-xl transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        glow && 'animate-glow-pulse',
        sizes[size],
        className,
      )}
      style={{ ...base, ...style }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          Object.assign((e.currentTarget as HTMLElement).style, hover)
        }
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          Object.assign((e.currentTarget as HTMLElement).style, base)
        }
        onMouseLeave?.(e)
      }}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : leftIcon}
      {children}
    </button>
  )
})

Button.displayName = 'Button'
export default Button
