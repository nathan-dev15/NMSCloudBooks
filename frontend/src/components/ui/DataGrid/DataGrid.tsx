import { useState, useCallback, useMemo } from 'react'
import { clsx } from 'clsx'
import type { DataGridProps, SortState, ColumnDef } from './gridTypes'
import { exportToCSV, exportToExcel, exportToPDF } from './exportUtils'
import Button from '../Button'

// ─── Sort indicator ────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (!direction) {
    return (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-faint)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4 4 4m6 0v12m0 0 4-4m-4 4-4-4" />
      </svg>
    )
  }
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary-400)' }}>
      {direction === 'asc'
        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0-4-4m4 4 4-4" />
        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0 4 4m-4-4-4 4" />}
    </svg>
  )
}

// ─── Row Actions Dropdown ──────────────────────────────────────────────────────

function RowActionsMenu<T>({ row, actions }: { row: T; actions: DataGridProps<T>['rowActions'] }) {
  const [open, setOpen] = useState(false)
  const visible = actions?.filter((a) => !a.hidden?.(row) && (a.visible ? a.visible(row) : true)) ?? []
  if (visible.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        aria-label="Row actions"
        className="p-1.5 rounded-lg transition-all duration-150"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.12)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--primary-400)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
        }}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5"  r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 z-20 mt-1 w-40 rounded-xl py-1 text-sm animate-slide-up"
            style={{
              background: 'var(--dark-700)',
              border: '1px solid rgba(12,122,130,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {visible.map((action, i) => (
              <button
                key={i}
                disabled={action.disabled?.(row)}
                onClick={(e) => { e.stopPropagation(); setOpen(false); action.onClick(row) }}
                className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors duration-100 disabled:opacity-40"
                style={{ color: action.variant === 'danger' ? '#ff6b35' : 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  const bg = action.variant === 'danger' ? 'rgba(255,107,53,0.08)' : 'rgba(12,122,130,0.08)'
                  ;(e.currentTarget as HTMLElement).style.background = bg
                }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Export Menu ───────────────────────────────────────────────────────────────

function ExportMenu<T>({ data, columns, config }: {
  data: T[]
  columns: ColumnDef<T>[]
  config: DataGridProps<T>['export']
}) {
  const [open, setOpen] = useState(false)
  if (!config) return null

  const { filename = 'export', csv = true, excel = true, pdf = true, columns: selectedCols } = config

  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen(!open)} leftIcon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      }>
        Export
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 z-20 mt-1 w-40 rounded-xl py-1 text-sm animate-slide-up"
            style={{
              background: 'var(--dark-700)',
              border: '1px solid rgba(12,122,130,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {[
              csv   && { label: 'CSV',        action: () => exportToCSV(data, columns, filename, selectedCols) },
              excel && { label: 'Excel',      action: () => exportToExcel(data, columns, filename, selectedCols) },
              pdf   && { label: 'PDF / Print', action: () => exportToPDF(data, columns, filename, selectedCols) },
            ].filter(Boolean).map((item: any, i) => (
              <button
                key={i}
                className="w-full text-left px-4 py-2 text-sm transition-colors duration-100"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.08)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                onClick={() => { setOpen(false); item.action() }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, pageSize, total, pageSizeOptions = [10, 25, 50, 100], onPageChange, onPageSizeChange }: NonNullable<DataGridProps['pagination']>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = Math.min((page - 1) * pageSize + 1, total)
  const end = Math.min(page * pageSize, total)

  const pages = useMemo(() => {
    const p: (number | '…')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) p.push(i)
    } else {
      p.push(1)
      if (page > 3) p.push('…')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) p.push(i)
      if (page < totalPages - 2) p.push('…')
      p.push(totalPages)
    }
    return p
  }, [page, totalPages])

  return (
    <div
      className="flex items-center justify-between px-4 py-3 flex-wrap gap-2"
      style={{ borderTop: '1px solid rgba(12,122,130,0.12)' }}
    >
      <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        <span>
          {total === 0 ? '0 results' : (
            <>{start}–{end} of <span style={{ color: 'var(--primary-400)' }}>{total}</span></>
          )}
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-sm rounded-lg px-2 py-1 focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(12,122,130,0.2)',
              color: 'var(--text-secondary)',
            }}
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s} style={{ background: 'var(--dark-800)' }}>{s} / page</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 rounded-lg text-sm transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { if (page !== 1) (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.1)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-2 py-1" style={{ color: 'var(--text-faint)' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className="w-8 h-8 rounded-lg text-sm font-medium transition-all duration-150"
              style={p === page ? {
                background: 'linear-gradient(135deg, #0c7a82, #0e949e)',
                color: 'white',
                boxShadow: '0 0 12px rgba(12,122,130,0.4)',
              } : {
                color: 'var(--text-muted)',
              }}
              onMouseEnter={(e) => {
                if (p !== page) (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.1)'
              }}
              onMouseLeave={(e) => {
                if (p !== page) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-2 py-1 rounded-lg text-sm transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { if (page !== totalPages) (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.1)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          ›
        </button>
      </div>
    </div>
  )
}

// ─── Main DataGrid ─────────────────────────────────────────────────────────────

export default function DataGrid<T = Record<string, unknown>>({
  columns,
  data,
  rowKey,
  loading = false,
  error,
  emptyMessage = 'No records found.',
  emptyIcon,
  sort,
  onSortChange,
  pagination,
  selectable,
  selection,
  rowActions,
  bulkActions,
  export: exportConfig,
  exportable,
  exportFilename,
  onRowClick,
  rowClassName,
  toolbar,
  compact = false,
  stickyHeader = false,
  className,
}: DataGridProps<T>) {
  const getRowKey = useCallback((row: T) => {
    return typeof rowKey === 'function'
      ? rowKey(row)
      : (row as Record<string, string | number>)[String(rowKey)]
  }, [rowKey])

  const visibleCols = columns.filter((c) => !c.hidden)
  const hasActions = (rowActions?.length ?? 0) > 0
  const hasSelection = !!selection || !!selectable
  const effectiveExport = exportConfig ?? (exportable ? { filename: exportFilename } : undefined)
  const selectedRows = useMemo(() => {
    if (!selection) return []
    return data.filter((row) => selection.selected.has(getRowKey(row)))
  }, [data, selection, getRowKey])

  const handleSort = useCallback((colKey: string) => {
    if (!onSortChange) return
    const next: SortState =
      sort?.key === colKey
        ? sort.direction === 'asc'
          ? { key: colKey, direction: 'desc' }
          : { key: colKey, direction: null }
        : { key: colKey, direction: 'asc' }
    onSortChange(next)
  }, [sort, onSortChange])

  const handleSelectAll = useCallback(() => {
    if (!selection) return
    const allKeys = new Set(data.map((r) => getRowKey(r)))
    const allSelected = data.every((r) => selection.selected.has(getRowKey(r)))
    selection.onSelectionChange(allSelected ? new Set() : allKeys, allSelected ? [] : data)
  }, [data, selection, getRowKey])

  const handleSelectRow = useCallback((row: T) => {
    if (!selection) return
    const key = getRowKey(row)
    const next = new Set(selection.selected)
    if (selection.mode === 'single') {
      next.clear()
      if (!selection.selected.has(key)) next.add(key)
    } else {
      next.has(key) ? next.delete(key) : next.add(key)
    }
    selection.onSelectionChange(next, data.filter((r) => next.has(getRowKey(r))))
  }, [selection, getRowKey, data])

  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3.5'

  return (
    <div
      className={clsx('w-full flex flex-col rounded-2xl overflow-hidden', className)}
      style={{
        background: 'var(--dark-800)',
        border: '1px solid rgba(12,122,130,0.15)',
      }}
    >
      {/* Toolbar */}
      {(toolbar || effectiveExport || (selectedRows.length > 0 && bulkActions)) && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
          style={{ borderBottom: '1px solid rgba(12,122,130,0.12)' }}
        >
          <div className="flex items-center gap-2 flex-1">
            {selectedRows.length > 0 && bulkActions && (
              <>
                <span className="text-sm font-semibold" style={{ color: 'var(--primary-400)' }}>
                  {selectedRows.length} selected
                </span>
                {bulkActions.map((a, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={a.variant === 'danger' ? 'danger' : 'outline'}
                    leftIcon={a.icon}
                    onClick={() => a.onClick(selectedRows)}
                  >
                    {a.label}
                  </Button>
                ))}
              </>
            )}
            {toolbar}
          </div>
          <ExportMenu data={data} columns={columns} config={effectiveExport} />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left">
          <thead className={clsx(stickyHeader && 'sticky top-0 z-10')}>
            <tr style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}>
              {hasSelection && (
                <th className={clsx(cellPadding, 'w-10')} style={{ background: 'rgba(12,122,130,0.05)' }}>
                  {selection?.mode === 'multi' && (
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all duration-150"
                      onClick={handleSelectAll}
                      style={{
                        border: `1px solid ${data.length > 0 && data.every((r) => selection.selected.has(getRowKey(r))) ? '#0c7a82' : 'rgba(12,122,130,0.3)'}`,
                        background: data.length > 0 && data.every((r) => selection.selected.has(getRowKey(r))) ? 'rgba(12,122,130,0.2)' : 'transparent',
                      }}
                    >
                      {data.length > 0 && data.every((r) => selection.selected.has(getRowKey(r))) && (
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#0c7a82' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                  )}
                </th>
              )}

              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth,
                    background: 'rgba(12,122,130,0.05)',
                    color: 'var(--text-muted)',
                  }}
                  className={clsx(
                    cellPadding, 'text-xs font-semibold uppercase tracking-wider whitespace-nowrap select-none',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer transition-colors duration-150',
                    col.className,
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  onMouseEnter={(e) => { if (col.sortable) (e.currentTarget as HTMLElement).style.color = 'var(--primary-400)' }}
                  onMouseLeave={(e) => { if (col.sortable) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <SortIcon direction={sort?.key === col.key ? sort.direction : null} />
                    )}
                  </span>
                </th>
              ))}

              {hasActions && (
                <th className={clsx(cellPadding, 'w-12')} style={{ background: 'rgba(12,122,130,0.05)' }} />
              )}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(12,122,130,0.06)' }}>
                  {hasSelection && (
                    <td className={cellPadding}>
                      <div className="w-4 h-4 rounded skeleton" />
                    </td>
                  )}
                  {visibleCols.map((col) => (
                    <td key={col.key} className={cellPadding}>
                      <div className={clsx('h-3.5 rounded skeleton', i % 3 === 0 ? 'w-3/4' : 'w-1/2')} />
                    </td>
                  ))}
                  {hasActions && <td className={cellPadding} />}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={visibleCols.length + (hasSelection ? 1 : 0) + (hasActions ? 1 : 0)} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.2)' }}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#ff6b35' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium" style={{ color: '#ff6b35' }}>{error}</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length + (hasSelection ? 1 : 0) + (hasActions ? 1 : 0)} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(12,122,130,0.1)', border: '1px solid rgba(12,122,130,0.2)' }}
                    >
                      {emptyIcon ?? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary-500)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-2.586a1 1 0 0 0-.707.293l-2.414 2.414a1 1 0 0 1-.707.293h-3.172a1 1 0 0 1-.707-.293l-2.414-2.414A1 1 0 0 0 6.586 13H4" />
                        </svg>
                      )}
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const key = getRowKey(row)
                const isSelected = selection?.selected.has(key) ?? false
                return (
                  <tr
                    key={key}
                    onClick={() => {
                      if (onRowClick) onRowClick(row)
                      if (selection) handleSelectRow(row)
                    }}
                    className={clsx(
                      'transition-colors duration-100',
                      (onRowClick || selection) && 'cursor-pointer',
                      rowClassName?.(row, idx),
                    )}
                    style={{
                      borderBottom: '1px solid rgba(12,122,130,0.06)',
                      background: isSelected ? 'rgba(12,122,130,0.08)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(12,122,130,0.05)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    {hasSelection && (
                      <td
                        className={cellPadding}
                        onClick={(e) => { e.stopPropagation(); handleSelectRow(row) }}
                      >
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-all duration-150"
                          style={{
                            border: `1px solid ${isSelected ? '#0c7a82' : 'rgba(12,122,130,0.3)'}`,
                            background: isSelected ? 'rgba(12,122,130,0.2)' : 'transparent',
                          }}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#0c7a82' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          )}
                        </div>
                      </td>
                    )}

                    {visibleCols.map((col) => (
                      <td
                        key={col.key}
                        className={clsx(
                          cellPadding,
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right',
                          col.className,
                        )}
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {col.render
                          ? col.render(row, idx)
                          : String((row as Record<string, unknown>)[col.key] ?? '—')}
                      </td>
                    ))}

                    {hasActions && (
                      <td className={clsx(cellPadding, 'text-right')} onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu row={row} actions={rowActions} />
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && <Pagination {...pagination} />}
    </div>
  )
}
