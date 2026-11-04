import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { logout } from '@/features/auth/authSlice'
import { useThemeSettings } from '@/contexts/ThemeSettingsContext'
import TweaksPanel from '@/components/ui/TweaksPanel'

interface HeaderProps {
  title: string
  actions?: React.ReactNode
}

const roleLabels: Record<string, string> = {
  super_admin:    'Super Admin',
  admin:          'Admin',
  primary_user:   'Primary User',
  secondary_user: 'Secondary User',
}

function IconBtn({
  onClick,
  title,
  children,
}: {
  onClick?: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: '32px', height: '32px',
        borderRadius: 'var(--r-md)',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 150ms, color 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-hover)'
        e.currentTarget.style.color = 'var(--text-1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-3)'
      }}
    >
      {children}
    </button>
  )
}

export default function Header({ title, actions }: HeaderProps) {
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((s) => s.auth)
  const { mode, toggleMode } = useThemeSettings()
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const [hasNotif] = useState(false)

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <>
      <header
        style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
          background: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Left: page title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '3px', height: '18px',
              borderRadius: '2px',
              background: 'var(--accent)',
              flexShrink: 0,
            }}
          />
          <h1 style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: '-0.01em',
            margin: 0,
          }}>
            {title}
          </h1>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {actions && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{actions}</div>
              <div style={{ width: '1px', height: '20px', background: 'var(--border-strong)', margin: '0 8px' }} />
            </>
          )}

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>

              {/* Role badge */}
              <span style={{
                padding: '3px 9px',
                borderRadius: 'var(--r-xl)',
                fontSize: '11px',
                fontWeight: 500,
                background: 'var(--accent-bg)',
                color: 'var(--accent)',
                border: '1px solid var(--border-strong)',
                whiteSpace: 'nowrap',
                marginRight: '4px',
              }}>
                {roleLabels[user.role] ?? user.role}
              </span>

              {/* Avatar — links to profile */}
              <Link
                to="/profile"
                title="My Profile"
                style={{ textDecoration: 'none', flexShrink: 0, lineHeight: 0 }}
              >
                <div
                  style={{
                    width: '28px', height: '28px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent-ink)',
                    fontSize: '10px', fontWeight: 700,
                    marginRight: '4px',
                    transition: 'opacity 150ms, box-shadow 150ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.opacity = '0.85'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px var(--accent)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.opacity = '1'
                    ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                  }}
                >
                  {initials}
                </div>
              </Link>

              <div style={{ width: '1px', height: '16px', background: 'var(--border-strong)', margin: '0 4px' }} />

              {/* Light / dark toggle */}
              <IconBtn
                onClick={toggleMode}
                title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                {mode === 'light' ? (
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                      d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75 9.75 9.75 0 0 1 8.25 6a9.72 9.72 0 0 1 .252-2.247A9.751 9.751 0 0 0 3 13.5a9.75 9.75 0 0 0 9.75 9.75c4.108 0 7.639-2.526 9.002-6.248Z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                      d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                  </svg>
                )}
              </IconBtn>

              {/* Notification bell */}
              <IconBtn title="Notifications">
                {hasNotif && (
                  <span style={{
                    position: 'absolute', top: '6px', right: '6px',
                    width: '6px', height: '6px',
                    borderRadius: '50%',
                    background: 'var(--status-error)',
                  }} />
                )}
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                    d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
              </IconBtn>

              {/* Portal tweaks */}
              <IconBtn onClick={() => setTweaksOpen(true)} title="Customize theme">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </IconBtn>

              {/* Sign out */}
              <button
                onClick={() => dispatch(logout())}
                title="Sign out"
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 10px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border-strong)',
                  background: 'transparent',
                  color: 'var(--text-3)',
                  fontSize: '12px', fontWeight: 500,
                  cursor: 'pointer',
                  marginLeft: '2px',
                  transition: 'background 150ms, border-color 150ms, color 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(153,27,27,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(153,27,27,0.3)'
                  e.currentTarget.style.color = 'var(--status-error)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                  e.currentTarget.style.color = 'var(--text-3)'
                }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
    </>
  )
}
