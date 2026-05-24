import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'
import type { UserRole } from '@/types'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  roles: UserRole[]
  group?: string
}

// ── Inline SVG icons ─────────────────────────────────────────────
const Icons = {
  Dashboard: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
  ),
  Users: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  ),
  Buildings: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ),
  Invoice: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  Clients: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  ),
  Inventory: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  ),
  PurchaseOrder: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
    </svg>
  ),
  Retail: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.016 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
    </svg>
  ),
  Agriculture: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
  ErrorLogs: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
  Civil: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.653-4.655m5.585-5.585-.11.088a2.25 2.25 0 0 1-2.673.128l-.092-.069-.136-.116a2.25 2.25 0 0 0-2.769 3.543l.136.116.069.092a2.25 2.25 0 0 1-.128 2.673l-.088.11-1.573 1.573" />
    </svg>
  ),
  List: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  ),
  Billing: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  Truck: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',         to: '/',                        icon: <Icons.Dashboard />,     roles: ['super_admin', 'admin', 'primary_user', 'secondary_user'], group: 'Overview' },
  { label: 'Tenants',           to: '/tenants',                 icon: <Icons.Buildings />,     roles: ['super_admin'],                                             group: 'Platform' },
  { label: 'Users',             to: '/users',                   icon: <Icons.Users />,         roles: ['super_admin', 'admin'],                                     group: 'Platform' },
  { label: 'Projects',          to: '/civil/projects',          icon: <Icons.Civil />,         roles: ['super_admin', 'admin', 'primary_user', 'secondary_user'],   group: 'Civil' },
  { label: 'Mat. Requests',     to: '/civil/requests',          icon: <Icons.List />,          roles: ['super_admin', 'admin', 'primary_user', 'secondary_user'],   group: 'Civil' },
  { label: 'Clients',           to: '/clients',                 icon: <Icons.Clients />,       roles: ['super_admin', 'admin', 'primary_user', 'secondary_user'],   group: 'Finance' },
  { label: 'Invoices',          to: '/invoices',                icon: <Icons.Invoice />,       roles: ['super_admin', 'admin', 'primary_user', 'secondary_user'],   group: 'Finance' },
  { label: 'Purchase Orders',   to: '/purchase-orders',         icon: <Icons.PurchaseOrder />, roles: ['super_admin', 'admin', 'primary_user'],                     group: 'Finance' },
  { label: 'Requisitions',      to: '/purchase-requisitions',   icon: <Icons.List />,          roles: ['super_admin', 'admin', 'primary_user'],                     group: 'Finance' },
  { label: 'Delivery Challans', to: '/delivery-challans',       icon: <Icons.Truck />,         roles: ['super_admin', 'admin', 'primary_user', 'secondary_user'],   group: 'Finance' },
  { label: 'Inventory',         to: '/inventory',               icon: <Icons.Inventory />,     roles: ['super_admin', 'admin', 'primary_user', 'secondary_user'],   group: 'Stock' },
  { label: 'Retail',            to: '/retail',                  icon: <Icons.Retail />,        roles: ['super_admin', 'admin', 'primary_user', 'secondary_user'],   group: 'Stock' },
  { label: 'Agriculture',       to: '/agriculture',             icon: <Icons.Agriculture />,   roles: ['super_admin', 'admin', 'primary_user', 'secondary_user'],   group: 'Stock' },
  { label: 'General Billing',   to: '/general-billing',         icon: <Icons.Billing />,       roles: ['super_admin', 'admin', 'primary_user', 'secondary_user'],   group: 'Stock' },
  { label: 'Settings',          to: '/settings',                icon: <Icons.Settings />,      roles: ['super_admin', 'admin'],                                     group: 'System' },
  { label: 'Error Logs',        to: '/error-logs',              icon: <Icons.ErrorLogs />,     roles: ['super_admin'],                                              group: 'System' },
]

const GROUP_ORDER = ['Overview', 'Platform', 'Civil', 'Finance', 'Stock', 'System']

const roleColors: Record<string, string> = {
  super_admin:    'linear-gradient(135deg, #5eead4 0%, #0c7a82 100%)',
  admin:          'linear-gradient(135deg, #93c5fd 0%, #1d4ed8 100%)',
  primary_user:   'linear-gradient(135deg, #86efac 0%, #15803d 100%)',
  secondary_user: 'linear-gradient(135deg, #fbbf24 0%, #b45309 100%)',
}

const roleLabels: Record<string, string> = {
  super_admin:    'Super Admin',
  admin:          'Admin',
  primary_user:   'Primary User',
  secondary_user: 'Secondary User',
}

interface TooltipState {
  label: string
  top: number
  left: number
}

export default function Sidebar() {
  const { user } = useAppSelector((s) => s.auth)
  const role = user?.role
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('nms_sidebar') === 'collapsed' } catch { return false }
  })

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      try { localStorage.setItem('nms_sidebar', next ? 'collapsed' : 'expanded') } catch {}
      return next
    })
  }, [])

  // Ctrl+B / Cmd+B
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        toggle()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toggle])

  const visible = NAV_ITEMS.filter((item) => role && item.roles.includes(role))
  const grouped = GROUP_ORDER.reduce<Record<string, NavItem[]>>((acc, g) => {
    const items = visible.filter((i) => i.group === g)
    if (items.length) acc[g] = items
    return acc
  }, {})
  const allVisibleItems = GROUP_ORDER.flatMap((g) => grouped[g] ?? [])
  const totalItems = allVisibleItems.length

  // ── Magnetic indicator ───────────────────────────────────────────
  const navRailRef = useRef<HTMLElement | null>(null)
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [indicatorTop, setIndicatorTop] = useState(0)
  const [indicatorHeight, setIndicatorHeight] = useState(36)
  const [indicatorVisible, setIndicatorVisible] = useState(false)
  const [indicatorKey, setIndicatorKey] = useState(0)

  useLayoutEffect(() => {
    const nav = navRailRef.current
    if (!nav) return

    const activeItem = allVisibleItems.find((item) =>
      item.to === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.to)
    )
    if (!activeItem) { setIndicatorVisible(false); return }

    const el = itemRefs.current.get(activeItem.to)
    if (!el) return

    const navRect = nav.getBoundingClientRect()
    const itemRect = el.getBoundingClientRect()
    setIndicatorTop(itemRect.top - navRect.top + nav.scrollTop)
    setIndicatorHeight(itemRect.height)
    setIndicatorVisible(true)
  }, [location.pathname, collapsed, indicatorKey, allVisibleItems])

  // Recalculate after sidebar width transition ends
  const sidebarRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = sidebarRef.current
    if (!el) return
    const handler = () => setIndicatorKey((k) => k + 1)
    el.addEventListener('transitionend', handler)
    return () => el.removeEventListener('transitionend', handler)
  }, [])

  // ── Click pulse ──────────────────────────────────────────────────
  const [pulse, setPulse] = useState<{ to: string; key: number } | null>(null)

  // ── Floating tooltip (portal) ────────────────────────────────────
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const handleMouseEnter = useCallback((e: React.MouseEvent, label: string) => {
    if (!collapsed) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 14 })
  }, [collapsed])

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <>
      <aside
        ref={(el) => { sidebarRef.current = el }}
        className={collapsed ? 'sidebar-collapsed' : ''}
        style={{
          width: collapsed ? '72px' : '248px',
          transition: 'width 520ms cubic-bezier(0.76, 0, 0.24, 1)',
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* ── Brand ─────────────────────────────────── */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            gap: '10px',
          }}
        >
          {/* Accent square mark */}
          <div
            style={{
              width: '32px', height: '32px',
              borderRadius: '8px',
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" fill="none" stroke="var(--accent-ink)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
          </div>

          {/* Name + tagline */}
          <div className="sidebar-brand-text" style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em', lineHeight: 1.25, whiteSpace: 'nowrap' }}>
              NMSCloudBooks
            </p>
            <p style={{ fontSize: '9px', fontWeight: 500, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '1px', whiteSpace: 'nowrap' }}>
              Billing Platform
            </p>
          </div>

          {/* Collapse toggle */}
          {!collapsed && (
            <button
              onClick={toggle}
              title="Collapse sidebar (Ctrl+B)"
              style={{
                width: '24px', height: '24px',
                borderRadius: '50%',
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-card)',
                color: 'var(--text-4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 150ms, border-color 150ms, color 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-active)'
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.color = 'var(--accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-card)'
                e.currentTarget.style.borderColor = 'var(--border-strong)'
                e.currentTarget.style.color = 'var(--text-4)'
              }}
            >
              <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Nav rail ─────────────────────────────── */}
        <nav
          ref={(el) => { navRailRef.current = el }}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '12px 0',
            position: 'relative',
          }}
        >
          {/* Magnetic active indicator */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: `${indicatorTop}px`,
              height: `${indicatorHeight}px`,
              width: '100%',
              background: 'var(--accent-bg)',
              borderLeft: '2px solid var(--accent)',
              borderRadius: '0 8px 8px 0',
              opacity: indicatorVisible ? 1 : 0,
              transition: [
                'top 460ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                'height 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                'opacity 200ms ease',
              ].join(', '),
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse 80% 100% at 20% 50%, var(--accent-glow), transparent)',
              borderRadius: 'inherit',
            }} />
          </div>

          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} style={{ marginBottom: '2px' }}>
              {/* Section label / divider */}
              {!collapsed ? (
                <p
                  className="sidebar-group-label"
                  style={{
                    fontSize: '10px', fontWeight: 500,
                    color: 'var(--text-4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '8px 14px 3px',
                    userSelect: 'none',
                  }}
                >
                  {group}
                </p>
              ) : (
                <div style={{
                  height: '1px',
                  background: 'var(--border)',
                  margin: '6px 10px 4px',
                }} />
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {items.map((item) => {
                  const gIdx = allVisibleItems.findIndex((i) => i.to === item.to)
                  const collapseDelay = `${gIdx * 22}ms`
                  const expandDelay = `${(totalItems - 1 - gIdx) * 22 + 80}ms`
                  const isActive = item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to)

                  return (
                    <div
                      key={item.to}
                      ref={(el) => {
                        if (el) itemRefs.current.set(item.to, el)
                        else itemRefs.current.delete(item.to)
                      }}
                      style={{ position: 'relative' }}
                      onClick={() => setPulse({ to: item.to, key: Date.now() })}
                      onMouseEnter={(e) => handleMouseEnter(e, item.label)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: collapsed ? '9px 0 9px 27px' : '9px 12px',
                          color: isActive ? 'var(--accent)' : 'var(--text-3)',
                          textDecoration: 'none',
                          position: 'relative',
                          zIndex: 1,
                          transition: 'color 150ms ease',
                          outline: 'none',
                          userSelect: 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-1)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'
                        }}
                      >
                        {item.icon}
                        <span
                          className="sidebar-nav-label"
                          style={{ transitionDelay: collapsed ? collapseDelay : expandDelay }}
                        >
                          {item.label}
                        </span>
                      </NavLink>

                      {/* Click pulse ring — emanates from the icon */}
                      {pulse?.to === item.to && (
                        <div
                          key={pulse.key}
                          className="nav-click-pulse"
                          style={{
                            top: '50%',
                            left: collapsed ? '36px' : '21px',
                          }}
                          onAnimationEnd={() => setPulse(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Expand toggle (collapsed mode only) */}
          {collapsed && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
              <button
                onClick={toggle}
                title="Expand sidebar (Ctrl+B)"
                style={{
                  width: '28px', height: '28px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-strong)',
                  background: 'transparent',
                  color: 'var(--text-4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 150ms, color 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-active)'
                  e.currentTarget.style.color = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-4)'
                }}
              >
                <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </nav>

        {/* ── Footer ────────────────────────────────── */}
        {user && (
          <div style={{
            padding: '10px 8px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: collapsed ? '8px 0 8px 12px' : '8px 10px',
              borderRadius: 'var(--r-lg)',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
            }}>
              <div
                title={collapsed ? `${user.full_name} · ${role ? roleLabels[role] : ''}` : undefined}
                style={{
                  width: '32px', height: '32px',
                  borderRadius: '50%',
                  background: role ? (roleColors[role] ?? roleColors['admin']) : roleColors['admin'],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white',
                  fontSize: '11px', fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>

              <div className="sidebar-brand-text" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <p style={{
                  fontSize: '13px', fontWeight: 600,
                  color: 'var(--text-1)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {user.full_name}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
                  {role ? roleLabels[role] : ''}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Floating tooltip portal */}
      {tooltip && createPortal(
        <div
          className="sidebar-floating-tooltip"
          style={{ top: `${tooltip.top}px`, left: `${tooltip.left}px` }}
        >
          {tooltip.label}
        </div>,
        document.body
      )}
    </>
  )
}
