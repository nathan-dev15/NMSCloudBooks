import { useEffect, useState, useCallback } from 'react'
import apiHandler from '@/services/apiHandler'
import { useNotification } from '@/hooks'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

interface ErrorLogEntry {
  id:                number
  error_code:        string | null
  error_type:        string | null
  error_message:     string
  error_stack_trace: string | null
  service_name:      string | null
  function_name:     string | null
  file_path:         string | null
  line_number:       number | null
  user_id:           number | null
  request_id:        string | null
  endpoint:          string | null
  http_method:       string | null
  ip_address:        string | null
  severity:          string | null
  is_resolved:       boolean
  resolution_notes:  string | null
  created_date:      string
}

interface ErrorLogsResponse {
  items:       ErrorLogEntry[]
  total:       number
  page:        number
  size:        number
  pages:       number
  unresolved:  number
}

const SEVERITY_CFG: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'rgba(157,78,221,0.12)', text: '#9d4edd', border: 'rgba(157,78,221,0.3)' },
  ERROR:    { bg: 'rgba(255,107,53,0.12)', text: '#ff6b35', border: 'rgba(255,107,53,0.3)' },
  WARNING:  { bg: 'rgba(255,193,7,0.12)',  text: '#ffc107', border: 'rgba(255,193,7,0.3)'  },
  INFO:     { bg: 'rgba(0,212,255,0.1)',   text: '#00d4ff', border: 'rgba(0,212,255,0.3)'  },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

function SeverityBadge({ severity }: { severity: string | null }) {
  const cfg = SEVERITY_CFG[severity ?? '']
  if (!cfg) return <span style={{ color: 'var(--text-faint)' }}>—</span>
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      {severity}
    </span>
  )
}

function Detail({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>{label}</p>
      <p
        className={`text-sm ${mono ? 'font-mono' : ''}`}
        style={{ color: 'var(--text-secondary)' }}
      >
        {value ?? '—'}
      </p>
    </div>
  )
}

const darkSelectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(12,122,130,0.2)',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '13px',
  color: 'var(--text-secondary)',
  outline: 'none',
}

export default function ErrorLogsPage() {
  const notify = useNotification()

  const [data,        setData]       = useState<ErrorLogsResponse | null>(null)
  const [loading,     setLoading]    = useState(false)
  const [page,        setPage]       = useState(1)
  const [severity,    setSeverity]   = useState('')
  const [isResolved,  setIsResolved] = useState<'' | 'true' | 'false'>('false')
  const [selected,    setSelected]   = useState<ErrorLogEntry | null>(null)
  const [resolveNote, setResolveNote]= useState('')
  const [resolving,   setResolving]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), size: '30' })
      if (severity)   params.set('severity', severity)
      if (isResolved) params.set('is_resolved', isResolved)
      const res = await apiHandler.get<ErrorLogsResponse>(`/error-logs?${params}`)
      setData(res.data!)
    } catch { notify.error('Failed to load error logs') }
    finally  { setLoading(false) }
  }, [page, severity, isResolved])

  useEffect(() => { load() }, [load])

  async function handleResolve(entry: ErrorLogEntry) {
    setResolving(true)
    try {
      await apiHandler.patch(`/error-logs/${entry.id}/resolve`, { resolution_notes: resolveNote || null })
      notify.success('Marked as resolved')
      setSelected(null)
      setResolveNote('')
      load()
    } catch { notify.error('Failed to resolve') }
    finally  { setResolving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this error log entry?')) return
    try {
      await apiHandler.delete(`/error-logs/${id}`)
      notify.success('Deleted')
      load()
    } catch { notify.error('Failed to delete') }
  }

  const unresolved = data?.unresolved ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Error Logs</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            System error log — all unhandled exceptions
            {unresolved > 0 && (
              <span className="ml-2 font-semibold" style={{ color: '#ff6b35' }}>{unresolved} unresolved</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} leftIcon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        }>
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Logs',  value: data.total,      color: 'var(--primary-400)', glow: 'rgba(12,122,130,0.3)' },
            { label: 'Unresolved', value: data.unresolved,  color: '#ff6b35',            glow: 'rgba(255,107,53,0.3)' },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl p-4"
              style={{
                background: 'var(--dark-800)',
                border: '1px solid rgba(12,122,130,0.15)',
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{c.label}</p>
              <p className="text-3xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={severity}
          onChange={(e) => { setSeverity(e.target.value); setPage(1) }}
          style={darkSelectStyle}
        >
          <option value="" style={{ background: 'var(--dark-800)' }}>All Severities</option>
          {['CRITICAL', 'ERROR', 'WARNING', 'INFO'].map((s) => (
            <option key={s} value={s} style={{ background: 'var(--dark-800)' }}>{s}</option>
          ))}
        </select>
        <select
          value={isResolved}
          onChange={(e) => { setIsResolved(e.target.value as '' | 'true' | 'false'); setPage(1) }}
          style={darkSelectStyle}
        >
          <option value="false" style={{ background: 'var(--dark-800)' }}>Unresolved</option>
          <option value="true"  style={{ background: 'var(--dark-800)' }}>Resolved</option>
          <option value=""      style={{ background: 'var(--dark-800)' }}>All</option>
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--dark-800)', border: '1px solid rgba(12,122,130,0.15)' }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary-600" />
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(12,122,130,0.1)', border: '1px solid rgba(12,122,130,0.2)' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary-500)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No error logs found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(12,122,130,0.15)', background: 'rgba(12,122,130,0.05)' }}>
                  {['Severity', 'Type', 'Message', 'Endpoint', 'Service', 'Time', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr
                    key={e.id}
                    className="table-row-dark cursor-pointer"
                    style={{ borderBottom: '1px solid rgba(12,122,130,0.06)' }}
                    onClick={() => setSelected(e)}
                  >
                    <td className="px-4 py-3"><SeverityBadge severity={e.severity} /></td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{e.error_type ?? '—'}</td>
                    <td className="px-4 py-3 max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>{e.error_message}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      {e.http_method} {e.endpoint ?? '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{e.service_name ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-faint)' }}>{fmtDate(e.created_date)}</td>
                    <td className="px-4 py-3">
                      {e.is_resolved ? (
                        <span className="text-xs font-semibold" style={{ color: '#06d6a0' }}>Resolved</span>
                      ) : (
                        <span className="text-xs font-semibold" style={{ color: '#ff6b35' }}>Open</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="text-xs px-2 py-1 rounded transition-colors duration-150"
                        style={{ color: '#ff6b35' }}
                        onMouseEnter={(el) => { (el.currentTarget as HTMLElement).style.background = 'rgba(255,107,53,0.1)' }}
                        onMouseLeave={(el) => { (el.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
          <span className="text-sm px-2" style={{ color: 'var(--text-muted)' }}>
            Page <span style={{ color: 'var(--primary-400)' }}>{page}</span> / {data.pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4"
          style={{ background: 'rgba(6,9,18,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl animate-slide-up"
            style={{
              background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
              border: '1px solid rgba(12,122,130,0.25)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7a82, #00d4ff)' }} />
                  <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Error Detail</h2>
                </div>
                <p className="text-xs font-mono mt-0.5 ml-3" style={{ color: 'var(--text-faint)' }}>
                  #{selected.id} · {selected.request_id ?? 'no request-id'}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
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

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {/* Grid details */}
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Severity"  value={<SeverityBadge severity={selected.severity} />} />
                <Detail label="Type"      value={selected.error_type} />
                <Detail label="Endpoint"  value={`${selected.http_method ?? ''} ${selected.endpoint ?? '—'}`} mono />
                <Detail label="Service"   value={selected.service_name} />
                <Detail label="User ID"   value={selected.user_id} />
                <Detail label="IP"        value={selected.ip_address} />
                <Detail label="Time"      value={fmtDate(selected.created_date)} />
                <Detail label="File"      value={selected.file_path ? `${selected.file_path}:${selected.line_number}` : null} mono />
              </div>

              {/* Message */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Message</p>
                <div
                  className="text-sm rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)', color: '#ff6b35' }}
                >
                  {selected.error_message}
                </div>
              </div>

              {/* Stack trace */}
              {selected.error_stack_trace && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Stack Trace</p>
                  <pre
                    className="text-xs rounded-xl px-4 py-3 overflow-x-auto whitespace-pre-wrap font-mono"
                    style={{ background: 'rgba(0,0,0,0.4)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.15)' }}
                  >
                    {selected.error_stack_trace}
                  </pre>
                </div>
              )}

              {/* Resolution notes */}
              {selected.is_resolved && selected.resolution_notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Resolution Notes</p>
                  <div
                    className="text-sm rounded-xl px-4 py-3"
                    style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)', color: '#06d6a0' }}
                  >
                    {selected.resolution_notes}
                  </div>
                </div>
              )}

              {/* Resolve form */}
              {!selected.is_resolved && (
                <div
                  className="space-y-3 pt-4"
                  style={{ borderTop: '1px solid rgba(12,122,130,0.15)' }}
                >
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Mark as Resolved</p>
                  <textarea
                    rows={2}
                    placeholder="Resolution notes (optional)"
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    className="input-dark w-full resize-none"
                  />
                  <Button
                    variant="success"
                    size="sm"
                    loading={resolving}
                    onClick={() => handleResolve(selected)}
                  >
                    ✓ Resolve
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
