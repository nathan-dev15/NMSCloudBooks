import { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchUsers, updateUser, deleteUser } from '@/features/users/usersSlice'
import { api, extractError } from '@/services/api'
import type { User } from '@/types'
import type { UserLog } from '@/features/users/usersSlice'
import CreateUserModal from '@/features/users/CreateUserModal'
import Button from '@/components/ui/Button'

const ROLE_LABEL: Record<string, string> = {
  super_admin:    'Super Admin',
  admin:          'Admin',
  primary_user:   'Primary User',
  secondary_user: 'Secondary User',
}

const ROLE_COLOR: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  super_admin:    { bg: 'rgba(157,78,221,0.1)',  text: '#9d4edd', border: 'rgba(157,78,221,0.3)', dot: '#9d4edd' },
  admin:          { bg: 'rgba(12,122,130,0.1)',  text: '#0e949e', border: 'rgba(12,122,130,0.3)', dot: '#0c7a82' },
  primary_user:   { bg: 'rgba(6,214,160,0.1)',   text: '#06d6a0', border: 'rgba(6,214,160,0.3)',  dot: '#06d6a0' },
  secondary_user: { bg: 'rgba(255,107,53,0.1)',  text: '#ff6b35', border: 'rgba(255,107,53,0.3)', dot: '#ff6b35' },
}

const SECTION_CFG: Record<string, { title: string; accent: string }> = {
  super_admin:    { title: 'Super Admins',    accent: 'rgba(157,78,221,0.5)' },
  admin:          { title: 'Admins',          accent: 'rgba(12,122,130,0.5)' },
  primary_user:   { title: 'Primary Users',   accent: 'rgba(6,214,160,0.5)'  },
  secondary_user: { title: 'Secondary Users', accent: 'rgba(255,107,53,0.5)' },
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

function Avatar({ name, role }: { name: string; role?: string }) {
  const rc = role ? ROLE_COLOR[role] : ROLE_COLOR.admin
  return (
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{
        background: `linear-gradient(135deg, ${rc?.dot ?? '#0c7a82'}, rgba(12,122,130,0.6))`,
        boxShadow: `0 0 8px ${rc?.bg ?? 'rgba(12,122,130,0.2)'}`,
      }}
    >
      {name[0]?.toUpperCase()}
    </div>
  )
}

function RolePill({ role }: { role: string }) {
  const rc = ROLE_COLOR[role]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: rc?.bg, color: rc?.text, border: `1px solid ${rc?.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: rc?.dot }} />
      {ROLE_LABEL[role] ?? role}
    </span>
  )
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={active
        ? { background: 'rgba(6,214,160,0.1)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.3)' }
        : { background: 'rgba(255,107,53,0.1)', color: '#ff6b35', border: '1px solid rgba(255,107,53,0.3)' }
      }
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? '#06d6a0' : '#ff6b35' }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ── Logs Drawer ────────────────────────────────────────────────────────────────

function LogsDrawer({ user, onClose }: { user: User; onClose: () => void }) {
  const [logs,    setLogs]  = useState<UserLog[]>([])
  const [loading, setLoad]  = useState(true)

  useEffect(() => {
    api.get<UserLog[]>(`/users/${user.id}/logs`, { params: { limit: 100 } })
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoad(false))
  }, [user.id])

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" style={{ background: 'rgba(6,9,18,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div
        className="w-full max-w-lg flex flex-col"
        style={{
          background: 'var(--dark-800)',
          borderLeft: '1px solid rgba(12,122,130,0.2)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
          <div className="flex items-center gap-3">
            <Avatar name={user.full_name} role={user.role} />
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{user.full_name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.15)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff6b35'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,53,0.3)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(12,122,130,0.15)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="px-6 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)', borderBottom: '1px solid rgba(12,122,130,0.1)', background: 'rgba(12,122,130,0.03)' }}>
          Activity Log
        </p>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>No activity logs found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ background: 'var(--dark-800)', borderBottom: '1px solid rgba(12,122,130,0.12)' }}>
                <tr>
                  {['Action', 'Resource', 'Description', 'Time'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="table-row-dark" style={{ borderBottom: '1px solid rgba(12,122,130,0.06)' }}>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex px-1.5 py-0.5 rounded text-xs font-semibold"
                        style={log.status === 'SUCCESS'
                          ? { background: 'rgba(6,214,160,0.12)', color: '#06d6a0' }
                          : { background: 'rgba(255,107,53,0.12)', color: '#ff6b35' }
                        }
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{log.resource_type}</td>
                    <td className="px-4 py-2.5 text-xs max-w-[180px] truncate" style={{ color: 'var(--text-secondary)' }}>{log.description ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-faint)' }}>{fmtDate(log.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────

function EditModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const dispatch = useAppDispatch()
  const [fullName, setFullName] = useState(user.full_name)
  const [phone,    setPhone]    = useState(user.phone ?? '')
  const [isActive, setIsActive] = useState(user.is_active)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')

  const save = async () => {
    setSaving(true); setErr('')
    try {
      await dispatch(updateUser({ id: user.id, full_name: fullName, phone: phone || undefined, is_active: isActive })).unwrap()
      onSaved()
    } catch (e: unknown) { setErr(extractError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(6,9,18,0.8)', backdropFilter: 'blur(8px)' }}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-4 animate-slide-up"
        style={{
          background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
          border: '1px solid rgba(12,122,130,0.25)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Edit — {user.email}</h3>
        </div>

        {err && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)', color: '#ff6b35' }}>
            {err}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold mb-1.5 tracking-wide" style={{ color: 'var(--text-muted)' }}>Full Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-dark w-full" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 tracking-wide" style={{ color: 'var(--text-muted)' }}>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input-dark w-full" />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className="w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all duration-150"
            onClick={() => setIsActive((v) => !v)}
            style={{
              border: `1px solid ${isActive ? '#0c7a82' : 'rgba(12,122,130,0.3)'}`,
              background: isActive ? 'rgba(12,122,130,0.2)' : 'transparent',
            }}
          >
            {isActive && (
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#0c7a82' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            )}
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Account Active</span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={save} loading={saving}>Save</Button>
        </div>
      </div>
    </div>
  )
}

// ── Team Drawer ────────────────────────────────────────────────────────────────

function TeamDrawer({ admin, onClose, onLogs }: {
  admin: User; onClose: () => void; onLogs: (u: User) => void
}) {
  const [tab,       setTab]       = useState<'primary_user' | 'secondary_user'>('primary_user')
  const [primary,   setPrimary]   = useState<User[]>([])
  const [secondary, setSecondary] = useState<User[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/users/${admin.id}/team`, { params: { role: 'primary_user',   size: 200 } }),
      api.get(`/users/${admin.id}/team`, { params: { role: 'secondary_user', size: 200 } }),
    ]).then(([p, s]: any) => {
      setPrimary(p.data.items)
      setSecondary(s.data.items)
    }).finally(() => setLoading(false))
  }, [admin.id])

  const shown = tab === 'primary_user' ? primary : secondary

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" style={{ background: 'rgba(6,9,18,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div
        className="w-full max-w-2xl flex flex-col"
        style={{
          background: 'var(--dark-800)',
          borderLeft: '1px solid rgba(12,122,130,0.2)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
          <div className="flex items-center gap-3">
            <Avatar name={admin.full_name} role={admin.role} />
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{admin.full_name}'s Team</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{admin.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.15)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff6b35'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,53,0.3)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(12,122,130,0.15)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex px-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.12)' }}>
          {(['primary_user', 'secondary_user'] as const).map((r) => {
            const count = r === 'primary_user' ? primary.length : secondary.length
            const isActive = tab === r
            return (
              <button
                key={r}
                onClick={() => setTab(r)}
                className="px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors duration-150"
                style={{
                  borderColor: isActive ? '#0c7a82' : 'transparent',
                  color: isActive ? 'var(--primary-400)' : 'var(--text-muted)',
                }}
              >
                {ROLE_LABEL[r]}
                <span
                  className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: isActive ? 'rgba(12,122,130,0.15)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? 'var(--primary-400)' : 'var(--text-faint)',
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : shown.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No users found</div>
          ) : (
            <table className="w-full text-sm">
              <thead style={{ borderBottom: '1px solid rgba(12,122,130,0.12)', background: 'rgba(12,122,130,0.03)' }}>
                <tr>
                  {['User', 'Status', 'Phone', ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.id} className="table-row-dark" style={{ borderBottom: '1px solid rgba(12,122,130,0.06)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.full_name} role={u.role} />
                        <div>
                          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.full_name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusPill active={u.is_active} /></td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>{u.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onLogs(u)}
                        className="px-2.5 py-1 text-xs font-medium rounded transition-colors duration-150"
                        style={{ color: 'var(--primary-400)', background: 'rgba(12,122,130,0.08)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.18)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.08)' }}
                      >
                        Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Role Section Table ─────────────────────────────────────────────────────────

interface SectionProps {
  role: string
  users: User[]
  loading: boolean
  currentUserId: number
  isSuperAdmin: boolean
  onLogs:   (u: User) => void
  onEdit:   (u: User) => void
  onDelete: (u: User) => void
  onTeam?:  (u: User) => void
}

function RoleSection({ role, users, loading, currentUserId, isSuperAdmin, onLogs, onEdit, onDelete, onTeam }: SectionProps) {
  const cfg = SECTION_CFG[role]
  const rc  = ROLE_COLOR[role]

  const ActionBtn = ({ label, color, hoverBg, onClick }: { label: string; color: string; hoverBg: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="px-2.5 py-1 text-xs font-medium rounded transition-colors duration-150"
      style={{ color, background: 'transparent' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = hoverBg }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {label}
    </button>
  )

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--dark-800)',
        border: '1px solid rgba(12,122,130,0.15)',
        borderLeft: `3px solid ${cfg.accent}`,
      }}
    >
      {/* Section header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid rgba(12,122,130,0.1)', background: 'rgba(12,122,130,0.03)' }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: rc?.dot }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{cfg.title}</h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.15)' }}
          >
            {users.length}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : users.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          No {cfg.title.toLowerCase()} found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(12,122,130,0.1)' }}>
                {['Name / Email', 'Role', 'Status', 'Phone', ...(isSuperAdmin ? ['Tenant'] : []), 'Actions'].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${h === 'Actions' ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--text-faint)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="table-row-dark" style={{ borderBottom: '1px solid rgba(12,122,130,0.06)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.full_name} role={u.role} />
                      <div>
                        <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{u.full_name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RolePill role={u.role} /></td>
                  <td className="px-4 py-3"><StatusPill active={u.is_active} /></td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>{u.phone ?? '—'}</td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {u.tenant_id ? `#${u.tenant_id}` : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {onTeam && role === 'admin' && (
                        <ActionBtn label="View Team" color="var(--primary-400)" hoverBg="rgba(12,122,130,0.1)" onClick={() => onTeam(u)} />
                      )}
                      <ActionBtn label="Logs" color="#9d4edd" hoverBg="rgba(157,78,221,0.08)" onClick={() => onLogs(u)} />
                      <ActionBtn label="Edit" color="var(--text-secondary)" hoverBg="rgba(255,255,255,0.06)" onClick={() => onEdit(u)} />
                      {u.id !== currentUserId && (
                        <ActionBtn label="Remove" color="#ff6b35" hoverBg="rgba(255,107,53,0.08)" onClick={() => onDelete(u)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const dispatch    = useAppDispatch()
  const currentUser = useAppSelector((s) => s.auth.user)
  const { items, isLoading } = useAppSelector((s) => s.users)

  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [createOpen,   setCreateOpen]   = useState(false)
  const [editTarget,   setEditTarget]   = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [teamAdmin,    setTeamAdmin]    = useState<User | null>(null)
  const [logsUser,     setLogsUser]     = useState<User | null>(null)
  const [search,       setSearch]       = useState('')

  const load = useCallback(() => { dispatch(fetchUsers({ size: 200 })) }, [dispatch])
  useEffect(() => { load() }, [load])

  const filtered = (role: string) =>
    items.filter((u) => u.role === role && (
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    ))

  const handleDelete = async () => {
    if (!deleteTarget) return
    await dispatch(deleteUser(deleteTarget.id))
    setDeleteTarget(null)
  }

  const visibleRoles = isSuperAdmin
    ? (['super_admin', 'admin', 'primary_user', 'secondary_user'] as const)
    : (['primary_user', 'secondary_user'] as const)

  const totalUsers  = items.length
  const activeUsers = items.filter((u) => u.is_active).length

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>User Management</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--primary-400)' }}>{totalUsers}</span> total ·{' '}
            <span style={{ color: '#06d6a0' }}>{activeUsers}</span> active
          </p>
        </div>
        <Button variant="gradient" onClick={() => setCreateOpen(true)} leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        }>
          New User
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ color: 'var(--text-muted)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="input-dark w-full pl-9"
        />
      </div>

      {/* Role sections */}
      {visibleRoles.map((role) => (
        <RoleSection
          key={role}
          role={role}
          users={filtered(role)}
          loading={isLoading}
          currentUserId={currentUser?.id ?? 0}
          isSuperAdmin={isSuperAdmin}
          onLogs={setLogsUser}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
          onTeam={isSuperAdmin ? setTeamAdmin : undefined}
        />
      ))}

      {/* Modals & Drawers */}
      <CreateUserModal open={createOpen} onClose={() => { setCreateOpen(false); load() }} />

      {editTarget && (
        <EditModal user={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load() }} />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(6,9,18,0.8)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="rounded-2xl p-6 max-w-sm w-full space-y-4 animate-slide-up"
            style={{
              background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
              border: '1px solid rgba(255,107,53,0.25)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.25)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#ff6b35' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Remove User</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Remove <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{deleteTarget.full_name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={handleDelete}>Remove</Button>
            </div>
          </div>
        </div>
      )}

      {teamAdmin && (
        <TeamDrawer
          admin={teamAdmin}
          onClose={() => setTeamAdmin(null)}
          onLogs={setLogsUser}
        />
      )}

      {logsUser && (
        <LogsDrawer user={logsUser} onClose={() => setLogsUser(null)} />
      )}
    </div>
  )
}
