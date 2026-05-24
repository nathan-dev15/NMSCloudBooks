import type { ReactNode } from 'react'

export type SortDirection = 'asc' | 'desc' | null

export interface SortState {
  key: string
  direction: SortDirection
}

export interface ColumnDef<T = Record<string, unknown>> {
  key: string
  header: string
  sortable?: boolean
  filterable?: boolean
  width?: string                         // e.g. "200px", "20%"
  minWidth?: string
  align?: 'left' | 'center' | 'right'
  hidden?: boolean
  render?: (row: T, index: number) => ReactNode
  exportValue?: ((row: T) => string | number) | keyof T | string  // value used during CSV/Excel export
  className?: string
}

export interface RowAction<T = Record<string, unknown>> {
  label: string
  icon?: ReactNode
  onClick: (row: T) => void
  hidden?: (row: T) => boolean
  visible?: (row: T) => boolean
  disabled?: (row: T) => boolean
  className?: string
  variant?: 'default' | 'danger'
}

export interface GridPagination {
  page: number
  pageSize: number
  total: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

export interface GridSelection<T = Record<string, unknown>> {
  mode: 'single' | 'multi'
  selected: Set<string | number>
  rowKey: ((row: T) => string | number) | keyof T | string
  onSelectionChange: (selected: Set<string | number>, rows: T[]) => void
}

export interface ExportConfig {
  filename?: string
  csv?: boolean
  excel?: boolean
  pdf?: boolean
  columns?: string[]    // column keys to include (default: all visible)
}

export interface DataGridProps<T = Record<string, unknown>> {
  // Data
  columns: ColumnDef<T>[]
  data: T[]
  rowKey: ((row: T) => string | number) | keyof T | string

  // State
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  emptyIcon?: ReactNode

  // Sorting (controlled)
  sort?: SortState
  onSortChange?: (sort: SortState) => void

  // Pagination (controlled)
  pagination?: GridPagination
  selectable?: boolean

  // Row selection
  selection?: GridSelection<T>

  // Row actions (dropdown per row)
  rowActions?: RowAction<T>[]

  // Bulk actions (shown when rows selected)
  bulkActions?: Array<{
    label: string
    icon?: ReactNode
    onClick: (selectedRows: T[]) => void
    variant?: 'default' | 'danger'
  }>

  // Export
  export?: ExportConfig
  exportable?: boolean
  exportFilename?: string

  // Row click
  onRowClick?: (row: T) => void

  // Row class customisation
  rowClassName?: (row: T, index: number) => string

  // Toolbar slot (rendered above table)
  toolbar?: ReactNode

  // Compact mode
  compact?: boolean

  // Sticky header
  stickyHeader?: boolean

  className?: string
}
