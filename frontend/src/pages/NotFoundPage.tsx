import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-4"
      style={{ background: 'var(--dark-900)' }}
    >
      {/* Glowing 404 */}
      <div className="relative mb-8">
        <h1
          className="text-[120px] font-black leading-none select-none"
          style={{
            background: 'linear-gradient(135deg, #0c7a82 0%, #00d4ff 50%, #9d4edd 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 40px rgba(12,122,130,0.4))',
          }}
        >
          404
        </h1>
        {/* Glow orb behind text */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(12,122,130,0.15) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }}
        />
      </div>

      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{
          background: 'linear-gradient(135deg, #0c7a82 0%, #0e949e 100%)',
          boxShadow: '0 0 32px rgba(12,122,130,0.4)',
        }}
      >
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        Page not found
      </h2>
      <p className="text-sm mb-8 max-w-sm" style={{ color: 'var(--text-muted)' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>

      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200"
        style={{
          background: 'linear-gradient(135deg, #0c7a82 0%, #0e949e 100%)',
          boxShadow: '0 0 20px rgba(12,122,130,0.35)',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(12,122,130,0.55)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(12,122,130,0.35)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Dashboard
      </Link>
    </div>
  )
}
