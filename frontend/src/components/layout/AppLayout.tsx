import { Navigate, Outlet } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'
import Sidebar from './Sidebar'
import Spinner from '@/components/ui/Spinner'

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAppSelector((s) => s.auth)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-canvas)' }}>
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0c7a82 0%, #00d4ff 100%)', boxShadow: '0 0 30px rgba(12,122,130,0.5)' }}>
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
            </div>
            <div className="absolute -inset-1 rounded-2xl animate-glow-pulse" style={{ background: 'linear-gradient(135deg, #0c7a82, #00d4ff)', opacity: 0.3, filter: 'blur(8px)', zIndex: -1 }} />
          </div>
          <Spinner size="md" className="text-primary-500" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading workspace…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-canvas)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: 'var(--bg-canvas)' }}>
        <Outlet />
      </div>
    </div>
  )
}
