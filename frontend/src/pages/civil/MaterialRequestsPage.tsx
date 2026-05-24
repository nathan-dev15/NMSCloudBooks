import { useEffect, useState, FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchRequests, createRequest, submitRequest, sendOTP, verifyOTP, rejectRequest } from '@/features/civil/civilSlice'
import Header from '@/components/layout/Header'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Alert from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import type { MaterialRequest } from '@/features/civil/civilTypes'

// ── Status + Priority metadata ────────────────────────────────────────────────

const STATUS_COLOR: Record<string, 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'orange' | 'purple'> = {
  draft: 'gray', pending: 'blue', otp_sent: 'yellow',
  approved: 'green', rejected: 'red', fulfilled: 'purple', cancelled: 'gray',
}
const PRIORITY_COLOR: Record<string, 'gray' | 'blue' | 'yellow' | 'red'> = {
  low: 'gray', standard: 'blue', high: 'yellow', urgent: 'red',
}

// ── Create Request modal ──────────────────────────────────────────────────────

interface ItemFormRow { material_name: string; requested_qty: string; unit_of_measure: string }

function CreateRequestModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: number | null }) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({ title: '', notes: '', priority: 'standard', required_by: '' })
  const [items, setItems] = useState<ItemFormRow[]>([{ material_name: '', requested_qty: '', unit_of_measure: 'nos' }])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const setItem = (i: number, k: keyof ItemFormRow) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setItems((prev) => prev.map((row, idx) => idx === i ? { ...row, [k]: e.target.value } : row))

  const addItem = () => setItems((p) => [...p, { material_name: '', requested_qty: '', unit_of_measure: 'nos' }])
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!projectId) { setError('No project selected'); return }
    setError(null); setLoading(true)
    const result = await dispatch(createRequest({
      ...form,
      project_id: projectId,
      items: items.map((it) => ({ ...it, requested_qty: Number(it.requested_qty) })),
    }))
    setLoading(false)
    if (createRequest.fulfilled.match(result)) {
      setForm({ title: '', notes: '', priority: 'standard', required_by: '' })
      setItems([{ material_name: '', requested_qty: '', unit_of_measure: 'nos' }])
      onClose()
    } else { setError(result.payload as string) }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Material Request" size="lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="create-req" loading={loading}>Create Request</Button></>}
    >
      {error && <Alert message={error} className="mb-4" />}
      <form id="create-req" onSubmit={handleSubmit} className="space-y-4">
        <Input label="Request Title" required value={form.title} onChange={setField('title')} placeholder="Cement and steel for Block A foundation" />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Priority" value={form.priority} onChange={setField('priority')} options={[
            { label: 'Low', value: 'low' }, { label: 'Standard', value: 'standard' },
            { label: 'High', value: 'high' }, { label: 'Urgent', value: 'urgent' },
          ]} />
          <Input label="Required By" type="date" value={form.required_by} onChange={setField('required_by')} />
        </div>
        <Input label="Notes" value={form.notes} onChange={setField('notes')} placeholder="Any additional details…" />

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Items</p>
            <Button size="sm" variant="ghost" type="button" onClick={addItem}>+ Add Item</Button>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Input label={i === 0 ? 'Material Name' : ''} required value={item.material_name}
                    onChange={setItem(i, 'material_name')} placeholder="OPC Cement 53 Grade" />
                </div>
                <div className="w-24">
                  <Input label={i === 0 ? 'Qty' : ''} type="number" required value={item.requested_qty}
                    onChange={setItem(i, 'requested_qty')} placeholder="50" />
                </div>
                <div className="w-24">
                  <Select label={i === 0 ? 'Unit' : ''} value={item.unit_of_measure} onChange={setItem(i, 'unit_of_measure')}
                    options={[
                      { label: 'nos', value: 'nos' }, { label: 'bags', value: 'bags' },
                      { label: 'MT', value: 'mt' }, { label: 'kg', value: 'kg' },
                      { label: 'sqm', value: 'sqm' }, { label: 'rmt', value: 'rmt' },
                    ]}
                  />
                </div>
                {items.length > 1 && (
                  <Button size="sm" variant="ghost" type="button" style={{ color: '#ff6b35', marginBottom: '2px' }}
                    onClick={() => removeItem(i)}>✕</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── OTP Verification modal ────────────────────────────────────────────────────

function OTPModal({ open, onClose, request }: { open: boolean; onClose: () => void; request: MaterialRequest | null }) {
  const dispatch = useAppDispatch()
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [sending, setSending] = useState(false)

  if (!request) return null

  const handleSendOTP = async () => {
    setSending(true); setError(null)
    const result = await dispatch(sendOTP(request.id))
    setSending(false)
    if (sendOTP.fulfilled.match(result)) { setOtpSent(true) }
    else { setError(result.payload as string) }
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true)
    const result = await dispatch(verifyOTP({ requestId: request.id, otp }))
    setLoading(false)
    if (verifyOTP.fulfilled.match(result)) { setOtp(''); setOtpSent(false); onClose() }
    else { setError(result.payload as string) }
  }

  return (
    <Modal open={open} onClose={onClose} title="OTP Approval"
      footer={
        otpSent
          ? <><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="otp-form" loading={loading}>Verify & Approve</Button></>
          : <><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSendOTP} loading={sending}>Send OTP to My Phone</Button></>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg p-4 text-sm" style={{
          background: 'rgba(0,212,255,0.06)',
          border: '1px solid rgba(0,212,255,0.2)',
        }}>
          <p className="font-semibold mb-1" style={{ color: '#00d4ff' }}>{request.title}</p>
          <p style={{ color: 'var(--text-secondary)' }}>
            {request.items.length} item(s) — Priority:{' '}
            <span className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{request.priority}</span>
          </p>
        </div>

        {error && <Alert message={error} />}

        {!otpSent ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            An OTP will be sent to your registered phone number to verify approval of this request.
          </p>
        ) : (
          <form id="otp-form" onSubmit={handleVerify}>
            <Input
              label="Enter OTP" required type="text" maxLength={6} inputMode="numeric"
              value={otp} onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit OTP" hint="OTP expires in 10 minutes"
            />
          </form>
        )}
      </div>
    </Modal>
  )
}

// ── Reject modal ──────────────────────────────────────────────────────────────

function RejectModal({ open, onClose, request }: { open: boolean; onClose: () => void; request: MaterialRequest | null }) {
  const dispatch = useAppDispatch()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  if (!request) return null

  const handleReject = async (e: FormEvent) => {
    e.preventDefault(); setLoading(true)
    await dispatch(rejectRequest({ requestId: request.id, reason }))
    setLoading(false); setReason(''); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Reject Request"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="danger" loading={loading} onClick={handleReject as any}>Reject Request</Button></>}
    >
      <form onSubmit={handleReject} className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Rejecting: <strong style={{ color: 'var(--text-primary)' }}>{request.title}</strong>
        </p>
        <Input label="Reason for rejection" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Insufficient budget / Duplicate request / etc." />
      </form>
    </Modal>
  )
}

// ── Request card ──────────────────────────────────────────────────────────────

function RequestCard({ req, onSubmit, onOTP, onReject, isAdmin }: {
  req: MaterialRequest
  onSubmit: () => void
  onOTP: () => void
  onReject: () => void
  isAdmin: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--dark-800)',
        border: hovered ? '1px solid rgba(12,122,130,0.45)' : '1px solid rgba(12,122,130,0.2)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: hovered ? '0 4px 24px rgba(12,122,130,0.12)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{req.title}</h3>
            <Badge color={STATUS_COLOR[req.status] ?? 'gray'}>{req.status.replace('_', ' ')}</Badge>
            <Badge color={PRIORITY_COLOR[req.priority] ?? 'gray'}>{req.priority}</Badge>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
            {req.items.length} item(s) · Stack position #{req.stack_position}
            {req.required_by && ` · Required by ${req.required_by}`}
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Hide items' : 'View items'}
          </Button>
          {req.status === 'draft' && (
            <Button size="sm" variant="outline" onClick={onSubmit}>Submit for Approval</Button>
          )}
          {isAdmin && req.status === 'pending' && (
            <>
              <Button size="sm" variant="primary" onClick={onOTP}>Approve (OTP)</Button>
              <Button size="sm" variant="ghost" style={{ color: '#ff6b35' }} onClick={onReject}>Reject</Button>
            </>
          )}
          {isAdmin && req.status === 'otp_sent' && (
            <Button size="sm" variant="primary" onClick={onOTP}>Enter OTP</Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(12,122,130,0.12)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-faint)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th className="text-left pb-2">Material</th>
                <th className="text-right pb-2">Requested</th>
                <th className="text-right pb-2">Approved</th>
                <th className="text-right pb-2">Issued</th>
              </tr>
            </thead>
            <tbody>
              {req.items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(12,122,130,0.08)' }}>
                  <td className="py-1.5" style={{ color: 'var(--text-primary)' }}>{item.material_name}</td>
                  <td className="py-1.5 text-right" style={{ color: 'var(--text-secondary)' }}>{item.requested_qty} {item.unit_of_measure}</td>
                  <td className="py-1.5 text-right" style={{ color: 'var(--text-muted)' }}>{item.approved_qty ?? '—'}</td>
                  <td className="py-1.5 text-right" style={{ color: 'var(--text-muted)' }}>{item.issued_qty ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {req.rejection_reason && (
            <div className="mt-3 p-3 rounded-lg text-sm" style={{
              background: 'rgba(255,107,53,0.08)',
              border: '1px solid rgba(255,107,53,0.25)',
              color: '#ff6b35',
            }}>
              Rejected: {req.rejection_reason}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MaterialRequestsPage() {
  const dispatch = useAppDispatch()
  const { requests, projects, isLoading, error } = useAppSelector((s) => s.civil)
  const currentRole = useAppSelector((s) => s.auth.user?.role)

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [otpTarget, setOtpTarget] = useState<MaterialRequest | null>(null)
  const [rejectTarget, setRejectTarget] = useState<MaterialRequest | null>(null)

  const isAdmin = !!currentRole && ['super_admin', 'admin'].includes(currentRole)

  useEffect(() => {
    if (selectedProjectId) {
      dispatch(fetchRequests({ projectId: selectedProjectId, status: filterStatus || undefined }))
    }
  }, [dispatch, selectedProjectId, filterStatus])

  const projectOptions = [
    { label: 'Select a project…', value: '' },
    ...projects.map((p) => ({ label: p.name, value: String(p.id) })),
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Material Requests"
        actions={
          selectedProjectId && (
            <Button variant="gradient" onClick={() => setCreateOpen(true)} leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }>
              New Request
            </Button>
          )
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && <Alert message={error} />}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-64">
            <Select
              label=""
              value={String(selectedProjectId ?? '')}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
              options={projectOptions}
            />
          </div>
          <Select
            label=""
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { label: 'All statuses', value: '' },
              { label: 'Draft', value: 'draft' }, { label: 'Pending', value: 'pending' },
              { label: 'OTP Sent', value: 'otp_sent' }, { label: 'Approved', value: 'approved' },
              { label: 'Rejected', value: 'rejected' }, { label: 'Fulfilled', value: 'fulfilled' },
            ]}
          />
          <span className="text-sm" style={{ color: 'var(--text-faint)' }}>{requests.length} request(s)</span>
        </div>

        {!selectedProjectId ? (
          <div className="text-center py-16">
            <p className="text-lg mb-2" style={{ color: 'var(--text-muted)' }}>Select a project</p>
            <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Choose a project above to view and manage material requests.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl skeleton" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--text-faint)' }}>
            No requests found. Create one to begin the approval workflow.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                isAdmin={isAdmin}
                onSubmit={() => dispatch(submitRequest(req.id))}
                onOTP={() => setOtpTarget(req)}
                onReject={() => setRejectTarget(req)}
              />
            ))}
          </div>
        )}
      </main>

      <CreateRequestModal open={createOpen} onClose={() => setCreateOpen(false)} projectId={selectedProjectId} />
      <OTPModal open={!!otpTarget} onClose={() => setOtpTarget(null)} request={otpTarget} />
      <RejectModal open={!!rejectTarget} onClose={() => setRejectTarget(null)} request={rejectTarget} />
    </div>
  )
}
