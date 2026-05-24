/**
 * Export utilities — CSV (native), Excel (xlsx), PDF (print)
 * All free: xlsx is Apache-2.0, jsPDF is MIT
 */

import type { ColumnDef } from './gridTypes'

function getExportValue<T>(column: ColumnDef<T>, row: T): unknown {
  if (typeof column.exportValue === 'function') return column.exportValue(row)
  if (column.exportValue) return (row as Record<string, unknown>)[String(column.exportValue)]
  return (row as Record<string, unknown>)[column.key]
}

// ─── CSV (no dependency) ──────────────────────────────────────────────────────

function escapeCSV(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportToCSV<T>(
  data: T[],
  columns: ColumnDef<T>[],
  filename = 'export.csv',
  selectedColumns?: string[],
): void {
  const cols = columns.filter(
    (c) => !c.hidden && (selectedColumns ? selectedColumns.includes(c.key) : true)
  )

  const header = cols.map((c) => escapeCSV(c.header)).join(',')
  const rows = data.map((row) =>
    cols
      .map((c) => {
        const raw = getExportValue(c, row)
        return escapeCSV(raw)
      })
      .join(',')
  )

  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Excel (xlsx — free, Apache-2.0) ─────────────────────────────────────────

export async function exportToExcel<T>(
  data: T[],
  columns: ColumnDef<T>[],
  filename = 'export',
  selectedColumns?: string[],
): Promise<void> {
  let XLSX: typeof import('xlsx')
  try {
    XLSX = await import('xlsx')
  } catch {
    console.warn('[DataGrid] xlsx not installed. Run: npm i xlsx')
    exportToCSV(data, columns, `${filename}.csv`, selectedColumns)
    return
  }

  const cols = columns.filter(
    (c) => !c.hidden && (selectedColumns ? selectedColumns.includes(c.key) : true)
  )

  const header = cols.map((c) => c.header)
  const rows = data.map((row) =>
    cols.map((c) => {
      return getExportValue(c, row)
    })
  )

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

// ─── PDF (print-based — no dependency) ───────────────────────────────────────

export function exportToPDF<T>(
  data: T[],
  columns: ColumnDef<T>[],
  title = 'Report',
  selectedColumns?: string[],
): void {
  const cols = columns.filter(
    (c) => !c.hidden && (selectedColumns ? selectedColumns.includes(c.key) : true)
  )

  const tableHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; }
        h2 { margin-bottom: 8px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #1a73e8; color: white; padding: 6px 10px; text-align: left; }
        td { border-bottom: 1px solid #e5e7eb; padding: 5px 10px; }
        tr:nth-child(even) { background: #f9fafb; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <h2>${title}</h2>
      <p style="color:#666;font-size:11px">Generated: ${new Date().toLocaleString()}</p>
      <table>
        <thead>
          <tr>${cols.map((c) => `<th>${c.header}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${data
            .map(
              (row) =>
                `<tr>${cols
                  .map((c) => {
                    const v = getExportValue(c, row)
                    return `<td>${v ?? ''}</td>`
                  })
                  .join('')}</tr>`
            )
            .join('')}
        </tbody>
      </table>
    </body>
    </html>
  `

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(tableHTML)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }
}
