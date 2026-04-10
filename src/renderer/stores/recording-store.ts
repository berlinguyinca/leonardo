import { create } from 'zustand'
import type { Resolution } from '@shared/types'
import { RESOLUTION_PRESETS } from '@shared/types'

type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing'

interface RecordingState {
  status: RecordingStatus
  currentUrl: string
  recordingDuration: number
  targetResolution: Resolution

  setStatus: (status: RecordingStatus) => void
  setCurrentUrl: (url: string) => void
  setRecordingDuration: (duration: number) => void
  setTargetResolution: (resolution: Resolution) => void
}

export const useRecordingStore = create<RecordingState>((set) => ({
  status: 'idle',
  currentUrl: '',
  recordingDuration: 0,
  targetResolution: RESOLUTION_PRESETS['1080p'],

  setStatus: (status) => set({ status }),
  setCurrentUrl: (url) => set({ currentUrl: url }),
  setRecordingDuration: (duration) => set({ recordingDuration: duration }),
  setTargetResolution: (resolution) => set({ targetResolution: resolution }),
}))
