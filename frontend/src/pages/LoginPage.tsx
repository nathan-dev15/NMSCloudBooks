import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { login, clearError } from '@/features/auth/authSlice'
import Spinner from '@/components/ui/Spinner'

type RoleTab = 'super_admin' | 'admin' | 'user'

const TABS: {
  key: RoleTab
  label: string
  description: string
  gradient: string
  glow: string
  accentColor: string
}[] = [
  {
    key:         'super_admin',
    label:       'Super Admin',
    description: 'Platform-level access',
    gradient:    'linear-gradient(135deg, #9d4edd 0%, #0c7a82 100%)',
    glow:        'rgba(157,78,221,0.5)',
    accentColor: '#9d4edd',
  },
  {
    key:         'admin',
    label:       'Admin',
    description: 'Tenant management access',
    gradient:    'linear-gradient(135deg, #0c7a82 0%, #00d4ff 100%)',
    glow:        'rgba(12,122,130,0.5)',
    accentColor: '#2aacb5',
  },
  {
    key:         'user',
    label:       'User',
    description: 'Standard user access',
    gradient:    'linear-gradient(135deg, #06d6a0 0%, #0c7a82 100%)',
    glow:        'rgba(6,214,160,0.5)',
    accentColor: '#06d6a0',
  },
]

const ROLE_ICONS: Record<RoleTab, React.ReactNode> = {
  super_admin: (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  ),
  admin: (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  ),
}

export default function LoginPage() {
  const dispatch  = useAppDispatch()
  const navigate  = useNavigate()
  const { isLoading, error } = useAppSelector((s) => s.auth)

  const [activeTab, setActiveTab] = useState<RoleTab>('admin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)

  const tab = TABS.find((t) => t.key === activeTab)!

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    dispatch(clearError())
    const result = await dispatch(login({ email, password }))
    if (login.fulfilled.match(result)) navigate('/')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--dark-900)' }}
    >
      {/* ── Animated background orbs ─────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{
            background: 'radial-gradient(circle, #0c7a82 0%, transparent 70%)',
            top: '-10%', left: '-10%',
            animation: 'orb 12s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-[0.06]"
          style={{
            background: 'radial-gradient(circle, #9d4edd 0%, transparent 70%)',
            bottom: '-5%', right: '-5%',
            animation: 'orb 15s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute w-[300px] h-[300px] rounded-full opacity-[0.05]"
          style={{
            background: 'radial-gradient(circle, #00d4ff 0%, transparent 70%)',
            top: '50%', left: '60%',
            animation: 'orb 10s ease-in-out infinite 3s',
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(12,122,130,0.8) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(12,122,130,0.8) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10 animate-slide-up">

        {/* ── Logo ──────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 relative">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #0c7a82 0%, #00d4ff 100%)',
                boxShadow: `0 0 40px rgba(12,122,130,0.5)`,
              }}
            >
              <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4}
                  d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
            </div>
            {/* Glow ring */}
            <div
              className="absolute inset-0 rounded-2xl animate-glow-pulse"
              style={{ background: 'linear-gradient(135deg, #0c7a82, #00d4ff)', opacity: 0.25, filter: 'blur(12px)', zIndex: -1 }}
            />
          </div>

          <h1
            className="text-2xl font-bold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #e1e8ed 0%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}
          >
            NMSCloudBooks
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Enterprise Billing Platform
          </p>
        </div>

        {/* ── Card ─────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
            border: '1px solid rgba(12,122,130,0.25)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(12,122,130,0.08)',
          }}
        >
          {/* Role tabs */}
          <div
            className="grid grid-cols-3"
            style={{ borderBottom: '1px solid rgba(12,122,130,0.12)' }}
          >
            {TABS.map((t) => {
              const isActive = activeTab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => { setActiveTab(t.key); dispatch(clearError()) }}
                  className="py-3.5 text-xs font-semibold transition-all duration-200 relative"
                  style={{
                    color: isActive ? t.accentColor : 'var(--text-faint)',
                    background: isActive ? 'rgba(12,122,130,0.06)' : 'transparent',
                  }}
                >
                  {isActive && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: t.gradient }}
                    />
                  )}
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="p-7">
            {/* Role info banner */}
            <div
              className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl"
              style={{
                background: 'rgba(12,122,130,0.06)',
                border: '1px solid rgba(12,122,130,0.15)',
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: tab.gradient, boxShadow: `0 0 12px ${tab.glow}` }}
              >
                {ROLE_ICONS[activeTab]}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: tab.accentColor }}>{tab.label} Login</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tab.description}</p>
              </div>
            </div>

            {/* Error alert */}
            {error && (
              <div
                className="mb-5 p-3.5 rounded-xl flex items-start gap-3 text-sm animate-slide-up"
                style={{
                  background: 'rgba(255,107,53,0.08)',
                  border: '1px solid rgba(255,107,53,0.25)',
                  color: '#ff8c69',
                }}
              >
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Email address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input-dark"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium transition-colors"
                    style={{ color: tab.accentColor }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-dark pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--text-faint)' }}
                    tabIndex={-1}
                  >
                    {showPwd ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 text-white text-sm font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                style={{
                  background: tab.gradient,
                  boxShadow: `0 0 24px ${tab.glow}`,
                }}
                onMouseEnter={(e) => { if (!isLoading) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)' }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Signing in…
                  </span>
                ) : (
                  `Sign in as ${tab.label}`
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-faint)' }}>
          NMSCloudBooks v1.0 &nbsp;·&nbsp; All rights reserved
        </p>
      </div>
    </div>
  )
}
