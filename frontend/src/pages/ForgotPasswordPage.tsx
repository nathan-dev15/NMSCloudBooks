import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, extractError } from '@/services/api'
import Spinner from '@/components/ui/Spinner'

type Step = 'form' | 'sent'

export default function ForgotPasswordPage() {
  const [email,      setEmail]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [step,       setStep]       = useState<Step>('form')
  const [error,      setError]      = useState<string | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post<{ message: string; reset_token?: string }>(
        '/auth/forgot-password',
        { email }
      )
      if (data.reset_token) setResetToken(data.reset_token)
      setStep('sent')
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--dark-900)' }}
    >
      {/* Animated orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none animate-orb"
        style={{ background: 'radial-gradient(ellipse, rgba(12,122,130,0.15) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none animate-orb"
        style={{ background: 'radial-gradient(ellipse, rgba(157,78,221,0.1) 0%, transparent 70%)', filter: 'blur(40px)', animationDelay: '3s' }} />

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
          {step === 'form' ? (
            <>
              <div className="text-center mb-6">
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
                  style={{ background: 'rgba(12,122,130,0.12)', border: '1px solid rgba(12,122,130,0.25)' }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary-400)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reset your password</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Enter your email and we'll send you a reset link.
                </p>
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
                <div>
                  <label className="block text-xs font-semibold mb-1.5 tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input-dark w-full"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #0c7a82 0%, #0e949e 100%)',
                    boxShadow: '0 0 20px rgba(12,122,130,0.35)',
                  }}
                >
                  {loading ? <><Spinner size="sm" /> Sending…</> : 'Send reset link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                style={{ background: 'rgba(6,214,160,0.1)', border: '1px solid rgba(6,214,160,0.25)' }}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#06d6a0' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Check your email</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                If <span style={{ color: 'var(--text-secondary)' }}>{email}</span> is registered, a reset link has been sent.
              </p>

              {resetToken && (
                <div
                  className="mb-6 p-4 rounded-xl text-left"
                  style={{
                    background: 'rgba(255,193,7,0.06)',
                    border: '1px solid rgba(255,193,7,0.2)',
                  }}
                >
                  <p className="text-xs font-semibold mb-1" style={{ color: '#ffc107' }}>
                    Dev mode — no email service configured
                  </p>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Use this link to reset your password:</p>
                  <Link
                    to={`/reset-password?token=${resetToken}`}
                    className="text-xs font-medium break-all"
                    style={{ color: 'var(--primary-400)' }}
                  >
                    /reset-password?token={resetToken.slice(0, 40)}…
                  </Link>
                </div>
              )}
            </div>
          )}

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
        </div>
      </div>
    </div>
  )
}
