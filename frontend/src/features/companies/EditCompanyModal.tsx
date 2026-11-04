import { useState, useEffect, FormEvent } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import ImageUpload from './ImageUpload'
import { useAppDispatch } from '@/app/hooks'
import { updateCompany } from './companiesSlice'
import type { Company } from '@/types'

interface Props { open: boolean; onClose: () => void; company: Company }

type F = 'name' | 'invoice_prefix' | 'invoice_starting_number' | 'email' | 'phone' | 'address' | 'gstin'

function validate(f: Record<string, string>): Partial<Record<F, string>> {
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

export default function EditCompanyModal({ open, onClose, company }: Props) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({
    name: '', invoice_prefix: '', invoice_starting_number: '',
    email: '', phone: '', address: '', gstin: '', logo_url: '',
  })
  const [imgs, setImgs] = useState<{ seal_url: string | null; signature_url: string | null }>({
    seal_url: null, signature_url: null,
  })
  const [errors, setErrors] = useState<Partial<Record<F, string>>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setErrors({}); setApiError(null)
      setForm({
        name: company.name,
        invoice_prefix: company.invoice_prefix,
        invoice_starting_number: String(company.invoice_starting_number),
        email: company.email,
        phone: company.phone,
        address: company.address,
        gstin: company.gstin,
        logo_url: company.logo_url ?? '',
      })
      setImgs({
        seal_url: company.seal_url ?? null,
        signature_url: company.signature_url ?? null,
      })
    }
  }, [open, company])

  const clear = (key: F) => setErrors((p) => { const n = { ...p }; delete n[key]; return n })

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [key]: e.target.value }))
    clear(key as F); setApiError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setApiError(null); setLoading(true)
    const result = await dispatch(updateCompany({
      id: company.id,
      name: form.name.trim(),
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
    if (updateCompany.fulfilled.match(result)) { onClose() }
    else { setApiError(result.payload as string) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit: ${company.name}`} size="lg" static
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="edit-co-form" loading={loading} variant="gradient">Save Changes</Button>
        </>
      }
    >
      {apiError && <Alert message={apiError} className="mb-4" />}
      <form id="edit-co-form" onSubmit={handleSubmit} className="form-light space-y-4" noValidate>

        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Company Details</p>

        <Input label="Company Name" value={form.name} onChange={set('name')} onKeyDown={() => clear('name')} error={errors.name} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Invoice Prefix" value={form.invoice_prefix} onChange={set('invoice_prefix')} onKeyDown={() => clear('invoice_prefix')} error={errors.invoice_prefix} />
          <Input label="Starting Number" type="number" min={1} value={form.invoice_starting_number} onChange={set('invoice_starting_number')} onKeyDown={() => clear('invoice_starting_number')} error={errors.invoice_starting_number} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Contact Email" type="email" value={form.email} onChange={set('email')} onKeyDown={() => clear('email')} error={errors.email} />
          <Input label="Phone" value={form.phone} onChange={set('phone')} onKeyDown={() => clear('phone')} error={errors.phone} />
        </div>

        <Input label="GSTIN" value={form.gstin} onChange={set('gstin')} onKeyDown={() => clear('gstin')} error={errors.gstin} />
        <Input label="Address" value={form.address} onChange={set('address')} onKeyDown={() => clear('address')} error={errors.address} />

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
