import { useState, useEffect, FormEvent } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { createUser } from './usersSlice'
import { fetchTenants } from '@/features/tenants/tenantsSlice'
import { api } from '@/services/api'
import type { UserRole } from '@/types'

interface BusinessType {
  id: number
  name: string
  description: string
}

const ROLE_OPTIONS_BY_CREATOR: Record<UserRole, { label: string; value: string }[]> = {
  super_admin: [
    { label: 'Admin',          value: 'admin' },
    { label: 'Primary User',   value: 'primary_user' },
    { label: 'Secondary User', value: 'secondary_user' },
  ],
  admin: [
    { label: 'Primary User',   value: 'primary_user' },
    { label: 'Secondary User', value: 'secondary_user' },
  ],
  primary_user:   [],
  secondary_user: [],
}

interface Props { open: boolean; onClose: () => void }

export default function CreateUserModal({ open, onClose }: Props) {
  const dispatch    = useAppDispatch()
  const currentRole = useAppSelector((s) => s.auth.user?.role) ?? 'admin'
  const tenants     = useAppSelector((s) => s.tenants.items)
  const isSuperAdmin = currentRole === 'super_admin'

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', role: '',
    phone: '', business_type_id: '', tenant_id: '',
  })
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([])
  const [loadingBT,     setLoadingBT]     = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [loading,       setLoading]       = useState(false)

  const roleOptions = ROLE_OPTIONS_BY_CREATOR[currentRole as UserRole] ?? []
  const isAdminRole = form.role === 'admin'

  // Fetch business types + tenants once when modal opens
  useEffect(() => {
    if (!open) return
    setLoadingBT(true)
    api.get<BusinessType[]>('/business-types')
      .then((r) => setBusinessTypes(r.data))
      .catch(() => setBusinessTypes([]))
      .finally(() => setLoadingBT(false))
    if (isSuperAdmin) dispatch(fetchTenants())
  }, [open, isSuperAdmin, dispatch])

  // Clear role-specific fields when role changes
  useEffect(() => {
    if (!isAdminRole) {
      setForm((prev) => ({ ...prev, business_type_id: '', tenant_id: '' }))
    }
  }, [isAdminRole])

  const set = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.role) { setError('Please select a role'); return }
    if (isAdminRole && !form.business_type_id) {
      setError('Please select a business type for admin'); return
    }
    if (isAdminRole && isSuperAdmin && !form.tenant_id) {
      setError('Please select a tenant for this admin'); return
    }

    setLoading(true)
    const payload: Record<string, unknown> = {
      full_name: form.full_name,
      email:     form.email,
      password:  form.password,
      role:      form.role,
      phone:     form.phone || undefined,
    }
    if (isAdminRole && form.business_type_id) {
      payload.business_type_id = Number(form.business_type_id)
    }
    if (isAdminRole && form.tenant_id) {
      payload.tenant_id = Number(form.tenant_id)
    }

    const result = await dispatch(createUser(payload))
    setLoading(false)

    if (createUser.fulfilled.match(result)) {
      setForm({ full_name: '', email: '', password: '', role: '', phone: '', business_type_id: '', tenant_id: '' })
      onClose()
    } else {
      setError(result.payload as string)
    }
  }

  const handleClose = () => {
    setError(null)
    setForm({ full_name: '', email: '', password: '', role: '', phone: '', business_type_id: '', tenant_id: '' })
    onClose()
  }

  const btOptions = [
    { label: loadingBT ? 'Loading…' : 'Select business type…', value: '' },
    ...businessTypes.map((bt) => ({ label: bt.name, value: String(bt.id) })),
  ]

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create New User"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button type="submit" form="create-user-form" loading={loading}>
            Create User
          </Button>
        </>
      }
    >
      {error && <Alert message={error} className="mb-4" />}

      <form id="create-user-form" onSubmit={handleSubmit} className="space-y-4">

        <Input
          label="Full Name" required
          value={form.full_name}
          onChange={set('full_name')}
          placeholder="Jane Doe"
        />

        <Input
          label="Email" type="email" required
          value={form.email}
          onChange={set('email')}
          placeholder="jane@company.com"
        />

        <Input
          label="Password" type="password" required
          value={form.password}
          onChange={set('password')}
          placeholder="Min 8 characters"
          hint="At least 8 characters"
        />

        <Input
          label="Phone"
          value={form.phone}
          onChange={set('phone')}
          placeholder="+91 98765 43210"
        />

        {/* Role selector */}
        <Select
          label="Role" required
          value={form.role}
          onChange={set('role')}
          options={[{ label: 'Select role…', value: '' }, ...roleOptions]}
        />

        {/* Business Type — cascades in ONLY when role = admin */}
        {isAdminRole && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-1">
            <label className="block text-sm font-medium text-blue-800">
              Business Type <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-blue-500 mb-2">
              Required for Admin — sets the business category for their account
            </p>
            <select
              required
              value={form.business_type_id}
              onChange={set('business_type_id')}
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {btOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tenant — required when Super Admin creates an Admin */}
        {isAdminRole && isSuperAdmin && (
          <div className="rounded-lg border border-teal-100 bg-teal-50 p-3 space-y-1">
            <label className="block text-sm font-medium text-teal-800">
              Tenant <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-teal-600 mb-2">
              Assign this admin to a tenant — required for company management
            </p>
            <select
              value={form.tenant_id}
              onChange={set('tenant_id')}
              className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="">Select tenant…</option>
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
