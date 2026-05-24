import { useState, useCallback } from 'react'

export interface PaginationState {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface UsePaginationReturn extends PaginationState {
  setPage: (p: number) => void
  setPageSize: (s: number) => void
  setTotal: (t: number) => void
  nextPage: () => void
  prevPage: () => void
  reset: () => void
  isFirst: boolean
  isLast: boolean
}

export function usePagination(initialPageSize = 20): UsePaginationReturn {
  const [page, setPageInternal] = useState(1)
  const [pageSize, setPageSizeInternal] = useState(initialPageSize)
  const [total, setTotal] = useState(0)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const setPage = useCallback((p: number) => setPageInternal(Math.max(1, Math.min(p, totalPages))), [totalPages])
  const setPageSize = useCallback((s: number) => { setPageSizeInternal(s); setPageInternal(1) }, [])
  const nextPage = useCallback(() => setPage(page + 1), [page, setPage])
  const prevPage = useCallback(() => setPage(page - 1), [page, setPage])
  const reset = useCallback(() => { setPageInternal(1) }, [])

  return {
    page, pageSize, total, totalPages,
    setPage, setPageSize, setTotal,
    nextPage, prevPage, reset,
    isFirst: page === 1,
    isLast: page >= totalPages,
  }
}
