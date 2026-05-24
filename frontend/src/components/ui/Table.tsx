import Spinner from './Spinner'
import Button from './Button'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string | number
  loading?: boolean
  emptyMessage?: string
  emptyHint?: string
  page?: number
  totalPages?: number
  totalItems?: number
  pageSize?: number
  onPageChange?: (page: number) => void
}

function EmptyIcon() {
  return (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary-600)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
        d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
    </svg>
  )
}

export default function Table<T>({
  columns, data, keyExtractor, loading, emptyMessage = 'No records found.', emptyHint,
  page, totalPages, totalItems, pageSize, onPageChange,
}: TableProps<T>) {
  const start = page !== undefined && pageSize ? (page - 1) * pageSize + 1 : undefined
  const end   = page !== undefined && pageSize && totalItems !== undefined
    ? Math.min(page * pageSize, totalItems)
    : undefined

  return (
    <div
      className="w-full overflow-hidden rounded-2xl"
      style={{
        background: 'var(--dark-800)',
        border: '1px solid rgba(12,122,130,0.15)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-[11px] font-semibold whitespace-nowrap tracking-widest uppercase ${col.className ?? ''}`}
                  style={{ color: 'var(--text-muted)', background: 'rgba(12,122,130,0.04)' }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Spinner size="lg" className="text-primary-600" />
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Loading…</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 animate-fade-in">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{
                        background: 'rgba(12,122,130,0.07)',
                        border: '1px solid rgba(12,122,130,0.18)',
                      }}
                    >
                      <EmptyIcon />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                        {emptyMessage}
                      </p>
                      {emptyHint && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>{emptyHint}</p>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={keyExtractor(row)} className="table-row-dark">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 ${col.className ?? ''}`}
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages !== undefined && totalPages > 1 && onPageChange && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid rgba(12,122,130,0.1)' }}
        >
          {/* Record range */}
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {start !== undefined && end !== undefined && totalItems !== undefined ? (
              <>
                Showing{' '}
                <span style={{ color: 'var(--primary-400)' }}>{start}–{end}</span>
                {' '}of{' '}
                <span style={{ color: 'var(--text-muted)' }}>{totalItems}</span>
              </>
            ) : (
              <>
                Page <span style={{ color: 'var(--primary-400)' }}>{page}</span> of {totalPages}
              </>
            )}
          </span>

          {/* Page buttons */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => onPageChange((page ?? 1) - 1)}
            >
              ← Prev
            </Button>

            {/* Page number pills */}
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = Math.max(1, Math.min((page ?? 1) - 2, totalPages - 4)) + i
              if (pg < 1 || pg > totalPages) return null
              const isActive = pg === page
              return (
                <button
                  key={pg}
                  onClick={() => onPageChange(pg)}
                  className="w-7 h-7 rounded-lg text-xs font-medium transition-all duration-150"
                  style={isActive
                    ? { background: 'rgba(12,122,130,0.25)', color: 'var(--primary-400)', border: '1px solid rgba(12,122,130,0.4)' }
                    : { background: 'transparent', color: 'var(--text-faint)', border: '1px solid transparent' }
                  }
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.1)' }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {pg}
                </button>
              )
            })}

            <Button
              size="sm"
              variant="outline"
              disabled={page === totalPages}
              onClick={() => onPageChange((page ?? 1) + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
