/**
 * useApi — SOW §6.4.10
 * Hook for making API calls with automatic loading/error/data states.
 * Integrates with the apiHandler for retry, circuit-breaker, and deduplication.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import apiHandler, { type ApiError, type RequestOptions } from '@/services/apiHandler'

export interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  called: boolean
}

export interface UseApiResult<T> extends UseApiState<T> {
  execute: (url: string, options?: RequestOptions) => Promise<T | null>
  reset: () => void
}

export function useGetApi<T>(
  url: string | null,
  options?: RequestOptions & { immediate?: boolean },
): UseApiResult<T> & { refetch: () => Promise<T | null> } {
  const [state, setState] = useState<UseApiState<T>>({
    data: null, loading: false, error: null, called: false,
  })
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const execute = useCallback(async (targetUrl: string, opts?: RequestOptions): Promise<T | null> => {
    if (!mounted.current) return null
    setState((s) => ({ ...s, loading: true, error: null, called: true }))
    try {
      const res = await apiHandler.get<T>(targetUrl, opts)
      if (mounted.current) setState({ data: res.data, loading: false, error: null, called: true })
      return res.data
    } catch (err) {
      const msg = (err as ApiError).message ?? 'Request failed'
      if (mounted.current) setState((s) => ({ ...s, data: null, loading: false, error: msg }))
      return null
    }
  }, [])

  const refetch = useCallback(() => {
    if (!url) return Promise.resolve(null)
    return execute(url, options)
  }, [url, options, execute])

  // Auto-fetch on mount if url provided and immediate not false
  useEffect(() => {
    if (url && options?.immediate !== false) { refetch() }
  }, [url])

  const reset = useCallback(() => setState({ data: null, loading: false, error: null, called: false }), [])

  return { ...state, execute, reset, refetch }
}

export function useMutationApi<TBody = unknown, TResponse = unknown>() {
  const [state, setState] = useState<UseApiState<TResponse>>({
    data: null, loading: false, error: null, called: false,
  })
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const post = useCallback(async (url: string, body?: TBody, opts?: RequestOptions): Promise<TResponse | null> => {
    setState((s) => ({ ...s, loading: true, error: null, called: true }))
    try {
      const res = await apiHandler.post<TResponse>(url, body, opts)
      if (mounted.current) setState({ data: res.data, loading: false, error: null, called: true })
      return res.data
    } catch (err) {
      const msg = (err as ApiError).message ?? 'Request failed'
      if (mounted.current) setState((s) => ({ ...s, loading: false, error: msg }))
      return null
    }
  }, [])

  const put = useCallback(async (url: string, body?: TBody, opts?: RequestOptions): Promise<TResponse | null> => {
    setState((s) => ({ ...s, loading: true, error: null, called: true }))
    try {
      const res = await apiHandler.put<TResponse>(url, body, opts)
      if (mounted.current) setState({ data: res.data, loading: false, error: null, called: true })
      return res.data
    } catch (err) {
      const msg = (err as ApiError).message ?? 'Request failed'
      if (mounted.current) setState((s) => ({ ...s, loading: false, error: msg }))
      return null
    }
  }, [])

  const patch = useCallback(async (url: string, body?: TBody, opts?: RequestOptions): Promise<TResponse | null> => {
    setState((s) => ({ ...s, loading: true, error: null, called: true }))
    try {
      const res = await apiHandler.patch<TResponse>(url, body, opts)
      if (mounted.current) setState({ data: res.data, loading: false, error: null, called: true })
      return res.data
    } catch (err) {
      const msg = (err as ApiError).message ?? 'Request failed'
      if (mounted.current) setState((s) => ({ ...s, loading: false, error: msg }))
      return null
    }
  }, [])

  const del = useCallback(async (url: string, opts?: RequestOptions): Promise<boolean> => {
    setState((s) => ({ ...s, loading: true, error: null, called: true }))
    try {
      await apiHandler.delete(url, opts)
      if (mounted.current) setState((s) => ({ ...s, loading: false, called: true }))
      return true
    } catch (err) {
      const msg = (err as ApiError).message ?? 'Delete failed'
      if (mounted.current) setState((s) => ({ ...s, loading: false, error: msg }))
      return false
    }
  }, [])

  const reset = useCallback(() => setState({ data: null, loading: false, error: null, called: false }), [])

  return { ...state, post, put, patch, delete: del, execute: post, reset }
}
