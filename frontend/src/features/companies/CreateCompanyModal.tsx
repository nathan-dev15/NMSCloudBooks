import { useState, FormEvent } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import ImageUpload from './ImageUpload'
import { useAppDispatch } from '@/app/hooks'
import { createCompany } from './companiesSlice'

interface Props { open: boolean; onClose: () => void }

type F = 'name' | 'slug' | 'invoice_prefix' | 'invoice_starting_number' | 'email' | 'phone' | 'address' | 'gstin' | 'logo_url'

const EMPTY = {
  name: '', slug: '', invoice_prefix: 'INV', invoice_starting_number: '1',
  email: '', phone: '', address: '', gstin: '',
  logo_url: '',
}

// image uploads stored separately (base64 strings)
const EMPTY_IMGS = { seal_url: null as string | null, signature_url: null as string | null }

const autoSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function validate(f: typeof EMPTY): Partial<Record<F, string>> {
  const e: Partial<Record<F, string>> = {}
  if (!f.name.trim())              e.name = 'Company name is required'
  if (!f.invoice_prefix.trim())    e.invoice_prefix = 'Invoice prefix is required'
  const n = parseInt(f.invoice_starting_number, 10)
  if (isNaN(n) || n < 1)          e.invoice_starting_number = 'Must be a number ≥ 1'
  if (!f.email.trim())             e.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email'
  if (!f.phone.trim())             e.phone = 'Phone is required'
  if (!f.address.trim())           e.address = 'Address is required'
  if (!f.gstin.trim())             e.gstin = 'GSTIN is required'
  return e
}

export default function CreateCompanyModal({ open, onClose }: Props) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState(EMPTY)
  const [imgs, setImgs] = useState(EMPTY_IMGS)
  const [errors, setErrors] = useState<Partial<Record<F, string>>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const clear = (key: F) => setErrors((p) => { const n = { ...p }; delete n[key]; return n })

  const set = (key: F) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [key]: e.target.value }))
    clear(key); setApiError(null)
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setForm((p) => ({ ...p, name, slug: autoSlug(name) }))
    clear('name'); clear('slug'); setApiError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setApiError(null); setLoading(true)
    const result = await dispatch(createCompany({
      name: form.name.trim(),
      slug: form.slug.trim(),
      invoice_prefix: form.invoice_prefix.trim(),
      invoice_starting_number: parseInt(form.invoice_starting_number, 10),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      gstin: form.gstin.trim(),
      logo_url: form.logo_url.trim() || null,
      seal_url: imgs.seal_url,
      signature_url: imgs.signature_url,
    }))
    setLoading(false)
    if (createCompany.fulfilled.match(result)) {
      setForm(EMPTY); setImgs(EMPTY_IMGS); setErrors({}); onClose()
    } else {
      setApiError(result.payload as string)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Company" size="lg" static
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="create-co-form" loading={loading} variant="gradient">Create</Button>
        </>
      }
    >
      {apiError && <Alert message={apiError} className="mb-4" />}
      <form id="create-co-form" onSubmit={handleSubmit} className="form-light space-y-4" noValidate>

        {/* ── Identity ──────────────────────────────────────── */}
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Company Details</p>

        <Input label="Company Name" value={form.name} onChange={handleNameChange} onKeyDown={() => clear('name')} placeholder="Acme Pvt Ltd" error={errors.name} />
        <Input label="Slug" value={form.slug} onChange={set('slug')} onKeyDown={() => clear('slug')} placeholder="acme-pvt-ltd" hint="Auto-generated" error={errors.slug} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Invoice Prefix" value={form.invoice_prefix} onChange={set('invoice_prefix')} onKeyDown={() => clear('invoice_prefix')} placeholder="INV" error={errors.invoice_prefix} />
          <Input label="Starting Number" type="number" min={1} value={form.invoice_starting_number} onChange={set('invoice_starting_number')} onKeyDown={() => clear('invoice_starting_number')} placeholder="1" error={errors.invoice_starting_number} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Contact Email" type="email" value={form.email} onChange={set('email')} onKeyDown={() => clear('email')} placeholder="billing@acme.com" error={errors.email} />
          <Input label="Phone" value={form.phone} onChange={set('phone')} onKeyDown={() => clear('phone')} placeholder="+91 9876543210" error={errors.phone} />
        </div>

        <Input label="GSTIN" value={form.gstin} onChange={set('gstin')} onKeyDown={() => clear('gstin')} placeholder="22AAAAA0000A1Z5" error={errors.gstin} />
        <Input label="Address" value={form.address} onChange={set('address')} onKeyDown={() => clear('address')} placeholder="123 Main St, City - 600001" error={errors.address} />

        {/* ── Branding ─────────────────────────────────────── */}
        <p className="text-xs font-semibold uppercase tracking-wider pt-2" style={{ color: '#64748b' }}>Branding (optional)</p>

        <Input label="Logo URL" value={form.logo_url} onChange={set('logo_url')} placeholder="https://cdn.example.com/logo.png" />
        <div className="grid grid-cols-2 gap-3">
          <ImageUpload label="Company Seal" value={imgs.seal_url} onChange={(v) => setImgs((p) => ({ ...p, seal_url: v }))} />
          <ImageUpload label="Signature" value={imgs.signature_url} onChange={(v) => setImgs((p) => ({ ...p, signature_url: v }))} />
        </div>
      </form>
    </Modal>
  )
}
