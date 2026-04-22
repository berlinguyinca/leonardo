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

// Timer registry ensures orphaned timers do not fire after their toast is
// removed — either manually via the close button or by MAX_TOASTS eviction.
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function clearTimer(id: string): void {
  const handle = timers.get(id)
  if (handle !== undefined) {
    clearTimeout(handle)
    timers.delete(id)
  }
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message, type) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`

    set((state) => {
      const combined = [...state.toasts, { id, message, type }]
      const kept = combined.slice(-MAX_TOASTS)
      const evicted = combined.slice(0, combined.length - kept.length)
      for (const t of evicted) clearTimer(t.id)
      return { toasts: kept }
    })

    const handle = setTimeout(() => {
      timers.delete(id)
      get().removeToast(id)
    }, DISMISS_DELAY[type])
    timers.set(id, handle)
  },

  removeToast: (id) => {
    clearTimer(id)
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))
