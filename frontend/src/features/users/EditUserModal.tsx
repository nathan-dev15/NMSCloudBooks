import { useState, FormEvent, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateUser } from './usersSlice'
import { fetchTenants } from '@/features/tenants/tenantsSlice'
import type { User } from '@/types'

interface Props { open: boolean; onClose: () => void; user: User | null }

export default function EditUserModal({ open, onClose, user }: Props) {
  const dispatch    = useAppDispatch()
  const currentRole = useAppSelector((s) => s.auth.user?.role)
  const tenants     = useAppSelector((s) => s.tenants.items)

  const isSuperAdmin  = currentRole === 'super_admin'
  const isAdminTarget = user?.role === 'admin'

  const [form, setForm] = useState({ full_name: '', phone: '', is_active: true, tenant_id: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name,
        phone: user.phone ?? '',
        is_active: user.is_active,
        tenant_id: user.tenant_id ? String(user.tenant_id) : '',
      })
    }
  }, [user])

  useEffect(() => {
    if (open && isSuperAdmin && isAdminTarget) dispatch(fetchTenants())
  }, [open, isSuperAdmin, isAdminTarget, dispatch])

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({
      ...prev,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError(null); setLoading(true)

    const patch: { id: number } & Record<string, unknown> = {
      id: user.id,
      full_name: form.full_name,
      phone: form.phone || undefined,
    }
    if (currentRole && ['super_admin', 'admin'].includes(currentRole)) {
      patch.is_active = form.is_active
    }
    if (isSuperAdmin && isAdminTarget && form.tenant_id) {
      patch.tenant_id = Number(form.tenant_id)
    }
    const result = await dispatch(updateUser(patch))
    setLoading(false)

    if (updateUser.fulfilled.match(result)) { onClose() }
    else { setError(result.payload as string) }
  }

  const canToggleActive = currentRole && ['super_admin', 'admin'].includes(currentRole)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit User"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-user-form" loading={loading}>Save Changes</Button>
        </>
      }
    >
      {error && <Alert message={error} className="mb-4" />}

      <form id="edit-user-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Full Name" required value={form.full_name} onChange={set('full_name')} />
        <Input label="Phone" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />

        {canToggleActive && (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={set('is_active')}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Account Active</span>
          </label>
        )}

        {/* Tenant assignment — Super Admin editing an Admin user */}
        {isSuperAdmin && isAdminTarget && (
          <div className="rounded-lg border border-teal-100 bg-teal-50 p-3 space-y-1">
            <label className="block text-sm font-medium text-teal-800">Tenant</label>
            <p className="text-xs text-teal-600 mb-2">
              {form.tenant_id ? 'Change the tenant this admin belongs to' : 'This admin has no tenant — assign one to enable company management'}
            </p>
            <select
              value={form.tenant_id}
              onChange={(e) => setForm((p) => ({ ...p, tenant_id: e.target.value }))}
              className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="">— no tenant —</option>
              {tenants.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
      </form>
    </Modal>
  )
}
