import { useState, FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, extractError } from '@/services/api'
import Spinner from '@/components/ui/Spinner'

export default function ResetPasswordPage() {
  const navigate   = useNavigate()
  const [params]   = useSearchParams()
  const token      = params.get('token') ?? ''

  const [password,       setPassword]       = useState('')
  const [confirm,        setConfirm]        = useState('')
  const [showPwd,        setShowPwd]        = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [done,           setDone]           = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const passwordsMatch = password === confirm
  const strong = password.length >= 8

  const strengthLevel = !password ? 0
    : password.length < 8 ? 1
    : password.length < 12 ? 2
    : 3

  const strengthColor = ['transparent', '#ff6b35', '#ffc107', '#06d6a0'][strengthLevel]
  const strengthLabel = ['', 'Weak', 'Fair', 'Strong'][strengthLevel]

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!passwordsMatch || !strong) return
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const InvalidLink = (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--dark-900)' }}
    >
      <div
        className="rounded-2xl p-8 max-w-sm w-full text-center"
        style={{
          background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
          border: '1px solid rgba(255,107,53,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4"
          style={{ background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.25)' }}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#ff6b35' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Invalid reset link</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          This reset link is missing or has expired.
        </p>
        <Link
          to="/forgot-password"
          className="text-sm font-medium"
          style={{ color: 'var(--primary-400)' }}
        >
          Request a new link →
        </Link>
      </div>
    </div>
  )

  if (!token) return InvalidLink

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--dark-900)' }}
    >
      {/* Orbs */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full pointer-events-none animate-orb"
        style={{ background: 'radial-gradient(ellipse, rgba(12,122,130,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full pointer-events-none animate-orb"
        style={{ background: 'radial-gradient(ellipse, rgba(157,78,221,0.08) 0%, transparent 70%)', filter: 'blur(40px)', animationDelay: '2s' }} />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, #0c7a82 0%, #0e949e 100%)',
              boxShadow: '0 0 32px rgba(12,122,130,0.5)',
            }}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #a0aec0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            NMSCloudBooks
          </h1>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
            border: '1px solid rgba(12,122,130,0.25)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(12,122,130,0.1)',
          }}
        >
          {done ? (
            <div className="text-center py-4">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                style={{ background: 'rgba(6,214,160,0.1)', border: '1px solid rgba(6,214,160,0.25)' }}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#06d6a0' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Password updated!</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
                  style={{ background: 'rgba(12,122,130,0.12)', border: '1px solid rgba(12,122,130,0.25)' }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary-400)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Set new password</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Must be at least 8 characters.</p>
              </div>

              {error && (
                <div
                  className="mb-5 p-3.5 rounded-xl text-sm flex items-start gap-2"
                  style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)', color: '#ff6b35' }}
                >
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Password field */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5 tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="input-dark w-full pr-11"
                      style={password && !strong ? { borderColor: 'rgba(255,107,53,0.5)' } : {}}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--primary-400)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d={showPwd
                            ? "M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                            : "M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"}
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Strength bar */}
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3].map((level) => (
                          <div
                            key={level}
                            className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{ background: strengthLevel >= level ? strengthColor : 'rgba(255,255,255,0.08)' }}
                          />
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: strengthColor }}>{strengthLabel}</p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-semibold mb-1.5 tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    Confirm password
                  </label>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className="input-dark w-full"
                    style={confirm && !passwordsMatch ? { borderColor: 'rgba(255,107,53,0.5)' } : {}}
                  />
                  {confirm && !passwordsMatch && (
                    <p className="mt-1.5 text-xs font-medium" style={{ color: '#ff6b35' }}>Passwords do not match.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !strong || !passwordsMatch}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #0c7a82 0%, #0e949e 100%)',
                    boxShadow: '0 0 20px rgba(12,122,130,0.35)',
                  }}
                >
                  {loading ? <><Spinner size="sm" /> Updating…</> : 'Update password'}
                </button>
              </form>
            </>
          )}

          {!done && (
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="text-sm flex items-center justify-center gap-1.5 transition-colors duration-150"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--primary-400)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
