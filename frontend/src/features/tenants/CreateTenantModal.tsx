import { useState, FormEvent } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import { useAppDispatch } from '@/app/hooks'
import { createTenant } from './tenantsSlice'

interface Props { open: boolean; onClose: () => void }

const PLAN_OPTIONS = [
  { label: 'Basic',      value: 'basic' },
  { label: 'Pro',        value: 'pro' },
  { label: 'Enterprise', value: 'enterprise' },
]

export default function CreateTenantModal({ open, onClose }: Props) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({ name: '', slug: '', plan: 'basic', email: '', gstin: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setForm((prev) => ({ ...prev, name, slug: autoSlug(name) }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setLoading(true)
    const result = await dispatch(createTenant({ ...form, email: form.email || undefined, gstin: form.gstin || undefined }))
    setLoading(false)
    if (createTenant.fulfilled.match(result)) {
      setForm({ name: '', slug: '', plan: 'basic', email: '', gstin: '' })
      onClose()
    } else {
      setError(result.payload as string)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Tenant"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="create-tenant-form" loading={loading}>Create Tenant</Button>
        </>
      }
    >
      {error && <Alert message={error} className="mb-4" />}
      <form id="create-tenant-form" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Organisation Name" required value={form.name} onChange={handleNameChange} placeholder="Acme Corp" />
        <Input label="Slug" required value={form.slug} onChange={set('slug')} placeholder="acme-corp" hint="URL-safe identifier — auto-generated from name" />
        <Select label="Subscription Plan" required value={form.plan} onChange={set('plan')} options={PLAN_OPTIONS} />
        <Input label="Contact Email" type="email" value={form.email} onChange={set('email')} placeholder="billing@acme.com" />
        <Input label="GSTIN" value={form.gstin} onChange={set('gstin')} placeholder="22AAAAA0000A1Z5" />
      </form>
    </Modal>
  )
}
