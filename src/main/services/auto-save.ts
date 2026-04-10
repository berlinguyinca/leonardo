import { AUTO_SAVE_INTERVAL_MS } from '@shared/constants'

let autoSaveInterval: ReturnType<typeof setInterval> | null = null
let isDirty = false
let onSave: (() => void) | null = null

export function startAutoSave(saveFn: () => void): void {
  onSave = saveFn
  if (autoSaveInterval) return

  autoSaveInterval = setInterval(() => {
    if (isDirty && onSave) {
      onSave()
      isDirty = false
    }
  }, AUTO_SAVE_INTERVAL_MS)
}

export function stopAutoSave(): void {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval)
    autoSaveInterval = null
  }
  onSave = null
}

export function markDirty(): void {
  isDirty = true
}

export function flushSave(): void {
  if (isDirty && onSave) {
    onSave()
    isDirty = false
  }
}
