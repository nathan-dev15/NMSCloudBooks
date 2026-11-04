import { Outlet, Link, useLocation } from 'react-router-dom'
import BackgroundAnimation from './BackgroundAnimation'

export default function PublicPageLayout() {
  const { pathname } = useLocation()
  const isEditor = /^\/mind-maps\/\d+/.test(pathname)

  return (
    <>
      <BackgroundAnimation />
      <div style={{
        position: 'relative', zIndex: 1, height: '100vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {!isEditor && (
          <nav style={{
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            flexShrink: 0,
            background: 'rgba(12, 12, 15, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border)',
          }}>
            <Link to="/mind-maps" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #0c7a82, #5eead4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="14" height="14" fill="none" stroke="#fff" viewBox="0 0 24 24" strokeWidth={2}>
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="4" cy="6" r="2" />
                  <circle cx="20" cy="6" r="2" />
                  <circle cx="4" cy="18" r="2" />
                  <circle cx="20" cy="18" r="2" />
                  <line x1="9.5" y1="10.5" x2="5.5" y2="7.5" />
                  <line x1="14.5" y1="10.5" x2="18.5" y2="7.5" />
                  <line x1="9.5" y1="13.5" x2="5.5" y2="16.5" />
                  <line x1="14.5" y1="13.5" x2="18.5" y2="16.5" />
                </svg>
              </div>
              <div>
                <span style={{
                  fontSize: '13px', fontWeight: 700,
                  color: 'var(--text-1)',
                  letterSpacing: '-0.02em',
                }}>
                  NMSCloudBooks
                </span>
                <span style={{
                  fontSize: '10px', fontWeight: 500,
                  color: 'var(--text-4)',
                  marginLeft: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Mind Maps
                </span>
              </div>
            </Link>

            <Link
              to="/login"
              style={{
                fontSize: '12px', fontWeight: 500,
                color: 'var(--text-3)',
                textDecoration: 'none',
                padding: '5px 14px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border-strong)',
                transition: 'color 150ms, border-color 150ms, background 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent)'
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.background = 'var(--accent-bg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-3)'
                e.currentTarget.style.borderColor = 'var(--border-strong)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Sign in
            </Link>
          </nav>
        )}
        <Outlet />
      </div>
    </>
  )
}
