import { create } from 'zustand'

export type ToastType = 'error' | 'warning' | 'info' | 'success'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type: ToastType) => void
  removeToast: (id: string) => void
}

const MAX_TOASTS = 3
const DISMISS_DELAY: Record<ToastType, number> = {
  info: 5000,
  success: 5000,
  error: 8000,
  warning: 8000,
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`

    set((state) => {
      const next = [...state.toasts, { id, message, type }]
      // Remove oldest toasts if over the limit
      return { toasts: next.slice(-MAX_TOASTS) }
    })

    setTimeout(() => {
      useToastStore.getState().removeToast(id)
    }, DISMISS_DELAY[type])
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))
