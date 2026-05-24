/**
 * useSearch — SOW §6.4.10
 * Combines search query, advanced filters, sorting, and pagination.
 * Designed to drive a DataGrid + SearchFilter combination.
 */
import { useState, useCallback, useEffect } from 'react'
import { useDebounce } from './useDebounce'
import { usePagination } from './usePagination'
import type { ActiveFilters } from '@/components/ui/SearchFilter/filterTypes'
import type { SortState } from '@/components/ui/DataGrid/gridTypes'

export interface UseSearchOptions {
  debounceMs?: number
  initialPageSize?: number
  initialSort?: SortState
}

export interface UseSearchReturn {
  // Query
  searchQuery: string
  setSearchQuery: (q: string) => void
  debouncedQuery: string

  // Filters
  filters: ActiveFilters
  setFilters: (f: ActiveFilters) => void
  activeFilterCount: number

  // Sort
  sort: SortState
  setSort: (s: SortState) => void

  // Pagination
  page: number
  pageSize: number
  total: number
  totalPages: number
  setPage: (p: number) => void
  setPageSize: (s: number) => void
  setTotal: (t: number) => void

  // Derived
  queryParams: Record<string, unknown>

  // Actions
  reset: () => void
}

const EMPTY_FILTERS: ActiveFilters = { conditions: [], logic: 'AND' }

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { debounceMs = 300, initialPageSize = 20, initialSort } = options

  const [searchQuery, setSearchQueryRaw] = useState('')
  const [filters, setFiltersRaw] = useState<ActiveFilters>(EMPTY_FILTERS)
  const [sort, setSortRaw] = useState<SortState>(initialSort ?? { key: '', direction: null })

  const debouncedQuery = useDebounce(searchQuery, debounceMs)
  const pagination = usePagination(initialPageSize)

  // Reset to page 1 whenever search/filter/sort changes
  const setSearchQuery = useCallback((q: string) => {
    setSearchQueryRaw(q)
    pagination.reset()
  }, [pagination])

  const setFilters = useCallback((f: ActiveFilters) => {
    setFiltersRaw(f)
    pagination.reset()
  }, [pagination])

  const setSort = useCallback((s: SortState) => {
    setSortRaw(s)
    pagination.reset()
  }, [pagination])

  const activeFilterCount = filters.conditions.filter(
    (c) => c.field && c.value !== null && c.value !== ''
  ).length

  // Build query params for API calls
  const queryParams: Record<string, unknown> = {
    page: pagination.page,
    size: pagination.pageSize,
    ...(debouncedQuery && { search: debouncedQuery }),
    ...(sort.key && sort.direction && { sort_by: sort.key, sort_dir: sort.direction }),
  }

  // Serialize filters into query params
  filters.conditions.forEach((cond, idx) => {
    if (!cond.field || !cond.value) return
    queryParams[`filter_${idx}_field`] = cond.field
    queryParams[`filter_${idx}_op`] = cond.operator
    queryParams[`filter_${idx}_val`] = Array.isArray(cond.value) ? cond.value.join(',') : String(cond.value)
  })
  if (activeFilterCount > 0) queryParams['filter_logic'] = filters.logic

  const reset = useCallback(() => {
    setSearchQueryRaw('')
    setFiltersRaw(EMPTY_FILTERS)
    setSortRaw({ key: '', direction: null })
    pagination.reset()
  }, [pagination])

  return {
    searchQuery, setSearchQuery, debouncedQuery,
    filters, setFilters, activeFilterCount,
    sort, setSort,
    ...pagination,
    queryParams,
    reset,
  }
}
