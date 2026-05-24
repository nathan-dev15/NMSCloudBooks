import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchUsers } from '@/features/users/usersSlice'
import { fetchTenants } from '@/features/tenants/tenantsSlice'
import Header from '@/components/layout/Header'
import StatCard from '@/components/ui/StatCard'
import { RoleBadge, StatusBadge } from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'

// ── Icons ──────────────────────────────────────────────────────
const Icon = {
  Users: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
  Buildings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ),
  Modules: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
  ),
  Active: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  Invoice: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  Clients: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  ),
  PO: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
    </svg>
  ),
  Inventory: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  ),
  AddUser: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
    </svg>
  ),
  Tenant: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
    </svg>
  ),
}

// ── Section card wrapper ────────────────────────────────────────
function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-slide-up"
      style={{
        background: 'var(--dark-800)',
        border: '1px solid rgba(12,122,130,0.15)',
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid rgba(12,122,130,0.1)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

// ── Empty state ─────────────────────────────────────────────────
function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(12,122,130,0.07)', border: '1px solid rgba(12,122,130,0.15)' }}
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary-600)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4}
            d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{message}</p>
        {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>{hint}</p>}
      </div>
    </div>
  )
}

// ── Quick-action card ───────────────────────────────────────────
interface QuickAction {
  label: string
  to: string
  icon: React.ReactNode
  gradient: string
  glow: string
}

function QuickActions({ items }: { items: QuickAction[] }) {
  return (
    <div className={`grid gap-3 stagger`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((a) => (
        <Link key={a.to} to={a.to}>
          <div className="quick-action">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{ background: a.gradient, boxShadow: `0 0 16px ${a.glow}` }}
            >
              {a.icon}
            </div>
            <span className="text-xs font-medium text-center" style={{ color: 'var(--text-secondary)' }}>
              {a.label}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ── Super Admin view ────────────────────────────────────────────
function SuperAdminDashboard() {
  const { items: tenants, isLoading: tenantsLoading } = useAppSelector((s) => s.tenants)
  const { total: userCount, isLoading: usersLoading }  = useAppSelector((s) => s.users)
  const activeTenants       = tenants.filter((t) => t.is_active).length
  const totalModulesEnabled = tenants.reduce((sum, t) => sum + t.enabled_modules.length, 0)

  const quickActions: QuickAction[] = [
    { label: 'Add Tenant',    to: '/tenants',         icon: <Icon.Tenant />,    gradient: 'linear-gradient(135deg,#0c7a82,#00d4ff)', glow: 'rgba(12,122,130,0.4)' },
    { label: 'Manage Users',  to: '/users',           icon: <Icon.Users />,     gradient: 'linear-gradient(135deg,#9d4edd,#0c7a82)', glow: 'rgba(157,78,221,0.4)' },
    { label: 'View Invoices', to: '/invoices',        icon: <Icon.Invoice />,   gradient: 'linear-gradient(135deg,#06d6a0,#0c7a82)', glow: 'rgba(6,214,160,0.4)'  },
    { label: 'Inventory',     to: '/inventory',       icon: <Icon.Inventory />, gradient: 'linear-gradient(135deg,#ff6b35,#9d4edd)', glow: 'rgba(255,107,53,0.4)' },
  ]

  if (tenantsLoading || usersLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        <StatCard label="Total Tenants"   value={tenants.length}      sub={`${activeTenants} active`}  icon={<Icon.Buildings />} color="teal" />
        <StatCard label="Total Users"     value={userCount}                                              icon={<Icon.Users />}    color="cyan" />
        <StatCard label="Active Tenants"  value={activeTenants}                                          icon={<Icon.Active />}   color="green" />
        <StatCard label="Modules Enabled" value={totalModulesEnabled}  sub="across all tenants"          icon={<Icon.Modules />}  color="purple" />
      </div>

      <SectionCard title="Quick Actions">
        <QuickActions items={quickActions} />
      </SectionCard>

      <SectionCard title="Tenant Overview">
        {tenants.length === 0 ? (
          <EmptyState message="No tenants yet" hint="Create one from Tenant Management." />
        ) : (
          <div className="space-y-1">
            {tenants.slice(0, 8).map((t, i) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl table-row-dark"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0c7a82 0%, #00d4ff 100%)' }}
                >
                  {t.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                  <span className="ml-2 text-xs" style={{ color: 'var(--text-faint)' }}>{t.slug}</span>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {t.enabled_modules.length === 0
                    ? <span className="text-xs" style={{ color: 'var(--text-faint)' }}>No modules</span>
                    : t.enabled_modules.slice(0, 3).map((m) => (
                        <span
                          key={m}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(12,122,130,0.12)', color: 'var(--primary-400)', border: '1px solid rgba(12,122,130,0.2)' }}
                        >
                          {m}
                        </span>
                      ))
                  }
                  {t.enabled_modules.length > 3 && (
                    <span className="text-[10px] px-1.5" style={{ color: 'var(--text-faint)' }}>
                      +{t.enabled_modules.length - 3}
                    </span>
                  )}
                </div>
                <StatusBadge active={t.is_active} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ── Admin view ──────────────────────────────────────────────────
function AdminDashboard() {
  const { total: userCount, items: users } = useAppSelector((s) => s.users)
  const activeUsers = users.filter((u) => u.is_active).length
  const teamMembers = users.filter((u) => u.role !== 'secondary_user').length

  const quickActions: QuickAction[] = [
    { label: 'Clients',   to: '/clients',         icon: <Icon.Clients />,   gradient: 'linear-gradient(135deg,#0c7a82,#00d4ff)', glow: 'rgba(12,122,130,0.4)'  },
    { label: 'Invoices',  to: '/invoices',         icon: <Icon.Invoice />,   gradient: 'linear-gradient(135deg,#06d6a0,#0c7a82)', glow: 'rgba(6,214,160,0.4)'   },
    { label: 'Orders',    to: '/purchase-orders',  icon: <Icon.PO />,        gradient: 'linear-gradient(135deg,#9d4edd,#0c7a82)', glow: 'rgba(157,78,221,0.4)'  },
    { label: 'Inventory', to: '/inventory',        icon: <Icon.Inventory />, gradient: 'linear-gradient(135deg,#ff6b35,#9d4edd)', glow: 'rgba(255,107,53,0.4)'  },
    { label: 'Add User',  to: '/users',            icon: <Icon.AddUser />,   gradient: 'linear-gradient(135deg,#d97706,#ff6b35)', glow: 'rgba(217,119,6,0.4)'   },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
        <StatCard label="Total Users"  value={userCount}   icon={<Icon.Users />}    color="teal" />
        <StatCard label="Active Users" value={activeUsers} icon={<Icon.Active />}   color="green" />
        <StatCard label="Team Members" value={teamMembers} sub="Primary &amp; above" icon={<Icon.Modules />} color="purple" />
      </div>

      <SectionCard title="Quick Actions">
        <QuickActions items={quickActions} />
      </SectionCard>

      <SectionCard title="Your Team">
        {users.length === 0 ? (
          <EmptyState message="No users in your tenant" hint="Add one from User Management." />
        ) : (
          <div className="space-y-1">
            {users.slice(0, 8).map((u, i) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl table-row-dark"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0c7a82, #2aacb5)' }}
                >
                  {u.full_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{u.full_name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{u.email}</p>
                </div>
                <RoleBadge role={u.role} />
                <StatusBadge active={u.is_active} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ── User view ───────────────────────────────────────────────────
function UserDashboard() {
  const { user } = useAppSelector((s) => s.auth)
  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const quickActions: QuickAction[] = [
    { label: 'Clients',   to: '/clients',   icon: <Icon.Clients />,   gradient: 'linear-gradient(135deg,#0c7a82,#00d4ff)', glow: 'rgba(12,122,130,0.4)' },
    { label: 'Invoices',  to: '/invoices',  icon: <Icon.Invoice />,   gradient: 'linear-gradient(135deg,#06d6a0,#0c7a82)', glow: 'rgba(6,214,160,0.4)'  },
    { label: 'Inventory', to: '/inventory', icon: <Icon.Inventory />, gradient: 'linear-gradient(135deg,#ff6b35,#9d4edd)', glow: 'rgba(255,107,53,0.4)' },
  ]

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 animate-slide-up"
        style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.15)' }}
      >
        <div className="absolute top-0 right-0 w-40 h-40 opacity-5 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #0c7a82 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
        <div className="flex items-center gap-5">
          <div className="relative inline-flex flex-shrink-0">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #0c7a82 0%, #00d4ff 100%)',
                boxShadow: '0 0 24px rgba(12,122,130,0.5)',
              }}
            >
              {initials}
            </div>
            <div
              className="absolute -inset-1 rounded-2xl -z-10"
              style={{ background: 'linear-gradient(135deg, #0c7a82, #00d4ff)', opacity: 0.2, filter: 'blur(10px)' }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{user?.full_name}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            <div className="mt-2">{user && <RoleBadge role={user.role} />}</div>
          </div>
        </div>
      </div>

      <SectionCard title="Quick Access">
        <QuickActions items={quickActions} />
      </SectionCard>
    </div>
  )
}

// ── Greeting banner ─────────────────────────────────────────────
function GreetingBanner({ firstName, today }: { firstName: string; today: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-5 animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, rgba(12,122,130,0.15) 0%, rgba(0,212,255,0.05) 100%)',
        border: '1px solid rgba(12,122,130,0.2)',
      }}
    >
      {/* Ambient orb */}
      <div
        className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(12,122,130,0.28) 0%, transparent 70%)',
          transform: 'translate(35%, -35%)',
        }}
      />

      <div className="relative">
        <p
          className="text-xl font-bold"
          style={{
            background: 'linear-gradient(135deg, #e1e8ed 0%, #2aacb5 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Welcome back, {firstName} 👋
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{today}</p>
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────
export default function DashboardPage() {
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((s) => s.auth)

  useEffect(() => {
    if (!user) return
    if (user.role === 'super_admin') {
      dispatch(fetchTenants())
      dispatch(fetchUsers({}))
    } else if (user.role === 'admin') {
      dispatch(fetchUsers({}))
    }
  }, [dispatch, user])

  const firstName = user?.full_name?.split(' ')[0] ?? 'there'
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <GreetingBanner firstName={firstName} today={today} />

        {user?.role === 'super_admin'                                           && <SuperAdminDashboard />}
        {user?.role === 'admin'                                                 && <AdminDashboard />}
        {user?.role && ['primary_user', 'secondary_user'].includes(user.role)   && <UserDashboard />}
      </main>
    </div>
  )
}
