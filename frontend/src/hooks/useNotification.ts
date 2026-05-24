import { useCallback } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { toastSuccess, toastError, toastWarning, toastInfo, removeToast, clearToasts } from '@/features/notifications/notificationsSlice'

export function useNotification() {
  const dispatch = useAppDispatch()

  return {
    success: useCallback((title: string, message?: string, duration?: number) => {
      dispatch(toastSuccess(title, message, duration))
    }, [dispatch]),

    error: useCallback((title: string, message?: string, duration?: number) => {
      dispatch(toastError(title, message, duration))
    }, [dispatch]),

    warning: useCallback((title: string, message?: string, duration?: number) => {
      dispatch(toastWarning(title, message, duration))
    }, [dispatch]),

    info: useCallback((title: string, message?: string, duration?: number) => {
      dispatch(toastInfo(title, message, duration))
    }, [dispatch]),

    dismiss: useCallback((id: string) => dispatch(removeToast(id)), [dispatch]),
    dismissAll: useCallback(() => dispatch(clearToasts()), [dispatch]),
  }
}
