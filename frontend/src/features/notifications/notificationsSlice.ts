import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number         // ms — 0 = persist until dismissed
  action?: { label: string; onClick: () => void }
}

interface NotificationsState {
  toasts: Toast[]
}

let _seq = 0
const nextId = () => `toast-${++_seq}`

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: { toasts: [] } as NotificationsState,
  reducers: {
    addToast: {
      prepare(payload: Omit<Toast, 'id'>) {
        return { payload: { ...payload, id: nextId() } as Toast }
      },
      reducer(state, action: PayloadAction<Toast>) {
        state.toasts.push(action.payload)
      },
    },
    removeToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload)
    },
    clearToasts(state) {
      state.toasts = []
    },
  },
})

export const { addToast, removeToast, clearToasts } = notificationsSlice.actions
export default notificationsSlice.reducer

// ─── Convenience action creators ──────────────────────────────────────────────

export const toastSuccess = (title: string, message?: string, duration = 4000) =>
  addToast({ type: 'success', title, message, duration })

export const toastError = (title: string, message?: string, duration = 6000) =>
  addToast({ type: 'error', title, message, duration })

export const toastWarning = (title: string, message?: string, duration = 5000) =>
  addToast({ type: 'warning', title, message, duration })

export const toastInfo = (title: string, message?: string, duration = 4000) =>
  addToast({ type: 'info', title, message, duration })
