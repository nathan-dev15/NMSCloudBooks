import { useState, useEffect, FormEvent } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { createTenant } from './tenantsSlice'
import { fetchSubscriptionPlans } from '@/features/subscriptions/subscriptionPlansSlice'
import type { BillingPeriod, SubscriptionPlan } from '@/types'

interface Props { open: boolean; onClose: () => void }

const BILLING_OPTIONS: { key: BillingPeriod; label: string; emoji: string; color: string; getPrice: (p: SubscriptionPlan) => string }[] = [
  {
    key: 'trial',
    label: '1 Month Free',
    emoji: '🎁',
    color: '#34d399',
    getPrice: (p) => `${p.trial_days} days free`,
  },
  {
    key: 'quarterly',
    label: '3 Months',
    emoji: '📅',
    color: '#2aacb5',
    getPrice: (p) => p.price_quarterly === 0 ? 'Custom pricing' : `₹${p.price_quarterly}`,
  },
  {
    key: 'yearly',
    label: '1 Year',
    emoji: '🏆',
    color: '#9d4edd',
    getPrice: (p) => p.price_yearly === 0 ? 'Custom pricing' : `₹${p.price_yearly}`,
  },
]

export default function CreateTenantModal({ open, onClose }: Props) {
  const dispatch = useAppDispatch()
  const plans = useAppSelector((s) => s.subscriptionPlans.items)

  const [form, setForm] = useState({
    name: '', slug: '', subscription_plan_id: '', email: '', gstin: '',
  })
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('trial')
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) dispatch(fetchSubscriptionPlans())
  }, [open, dispatch])

  // Pre-select first plan when plans load
  useEffect(() => {
    if (plans.length > 0 && !form.subscription_plan_id) {
      setForm((prev) => ({ ...prev, subscription_plan_id: String(plans[0].id) }))
    }
  }, [plans, form.subscription_plan_id])

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
    if (!form.subscription_plan_id) { setError('Please select a subscription plan'); return }
    setError(null); setLoading(true)
    const result = await dispatch(createTenant({
      name: form.name,
      slug: form.slug,
      subscription_plan_id: Number(form.subscription_plan_id),
      billing_period: billingPeriod,
      email: form.email || undefined,
      gstin: form.gstin || undefined,
    }))
    setLoading(false)
    if (createTenant.fulfilled.match(result)) {
      setForm({ name: '', slug: '', subscription_plan_id: '', email: '', gstin: '' })
      setBillingPeriod('trial')
      onClose()
    } else {
      setError(result.payload as string)
    }
  }

  const selectedPlan = plans.find((p) => String(p.id) === form.subscription_plan_id)

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
        <Input
          label="Organisation Name" required
          value={form.name} onChange={handleNameChange}
          placeholder="Acme Corp"
        />
        <Input
          label="Slug" required
          value={form.slug} onChange={set('slug')}
          placeholder="acme-corp"
          hint="URL-safe identifier — auto-generated from name"
        />

        {/* Subscription Plan selector */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Subscription Plan <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            required
            value={form.subscription_plan_id}
            onChange={set('subscription_plan_id')}
            style={{
              width: '100%',
              background: 'var(--dark-700)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '14px',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          >
            <option value="">Select a plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name} — {p.price_quarterly === 0 ? 'Custom pricing' : `₹${p.price_quarterly}/3mo · ₹${p.price_yearly}/yr`}
              </option>
            ))}
          </select>
        </div>

        {/* Billing period selector — shown when a plan is selected */}
        {selectedPlan && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Billing Period <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BILLING_OPTIONS.map((opt) => {
                const active = billingPeriod === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setBillingPeriod(opt.key)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '10px',
                      border: `1.5px solid ${active ? opt.color : 'var(--border)'}`,
                      background: active ? `${opt.color}18` : 'var(--dark-700)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '18px', lineHeight: 1, marginBottom: '4px' }}>{opt.emoji}</div>
                    <div style={{
                      fontSize: '11px', fontWeight: 700,
                      color: active ? opt.color : 'var(--text-primary)',
                      marginBottom: '2px',
                    }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '11px', color: active ? opt.color : 'var(--text-faint)', fontWeight: 500 }}>
                      {opt.getPrice(selectedPlan)}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Plan preview — modules + features auto-applied */}
            <div
              className="mt-3 rounded-lg overflow-hidden"
              style={{ border: '1px solid rgba(12,122,130,0.15)' }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ background: 'rgba(12,122,130,0.08)', borderBottom: '1px solid rgba(12,122,130,0.1)' }}
              >
                <span className="text-xs font-semibold" style={{ color: 'var(--primary-400)' }}>
                  {selectedPlan.name} — what's included
                </span>
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  {selectedPlan.max_users != null ? `${selectedPlan.max_users} users` : '∞ users'} ·{' '}
                  {selectedPlan.max_companies != null ? `${selectedPlan.max_companies} co.` : '∞ co.'}
                </span>
              </div>

              <div className="px-3 py-2 space-y-2" style={{ background: 'rgba(12,122,130,0.03)' }}>
                {/* Modules — auto-enabled on tenant */}
                {selectedPlan.enabled_modules.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                      Modules enabled automatically:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPlan.enabled_modules.map((mod) => (
                        <span
                          key={mod}
                          style={{
                            fontSize: '10px', padding: '2px 8px', borderRadius: '99px',
                            background: 'rgba(12,122,130,0.15)', color: 'var(--primary-400)',
                            textTransform: 'capitalize', fontWeight: 500,
                          }}
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Features */}
                <div className="space-y-0.5">
                  {selectedPlan.features.slice(0, 4).map((f, i) => (
                    <p key={i} className="text-xs flex gap-1" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color: '#34d399', flexShrink: 0 }}>✓</span> {f}
                    </p>
                  ))}
                  {selectedPlan.features.length > 4 && (
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      +{selectedPlan.features.length - 4} more features
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <Input label="Contact Email" type="email" value={form.email} onChange={set('email')} placeholder="billing@acme.com" />
        <Input label="GSTIN" value={form.gstin} onChange={set('gstin')} placeholder="22AAAAA0000A1Z5" maxLength={50} />
      </form>
    </Modal>
  )
}
