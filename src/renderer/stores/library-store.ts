import { create } from 'zustand'
import type { Clip } from '@shared/types/events'
import { useTimelineStore } from './timeline-store'
import { useScriptStore } from './script-store'
import { useToastStore } from './toast-store'

interface LibraryState {
  clips: Clip[]
  highlightedClipId: string | null

  loadClips: (projectId?: string) => Promise<void>
  addClip: (clip: Clip) => Promise<void>
  removeClip: (id: string) => Promise<void>
  setHighlightedClip: (id: string | null) => void
}

function hasBridge(): boolean {
  return typeof window !== 'undefined' && !!window.leonardo?.clip
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  clips: [],
  highlightedClipId: null,

  loadClips: async (projectId?: string) => {
    if (!hasBridge()) return
    try {
      const clips = await window.leonardo.clip.list(projectId)
      set({ clips })
    } catch (err) {
      console.error('[LibraryStore] Failed to load clips:', err)
      useToastStore.getState().addToast('Failed to load clips', 'error')
    }
  },

  addClip: async (clip) => {
    if (hasBridge()) {
      try {
        await window.leonardo.clip.create(clip)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        useToastStore.getState().addToast(`Failed to save clip: ${msg}`, 'error')
        return
      }
    }
    set((state) => ({ clips: [clip, ...state.clips] }))
  },

  removeClip: async (id) => {
    const clip = get().clips.find((c) => c.id === id)
    if (hasBridge()) {
      try {
        await window.leonardo.clip.delete(id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        useToastStore.getState().addToast(`Failed to delete clip: ${msg}`, 'error')
        return
      }
    }
    if (clip) {
      useTimelineStore.getState().removeSegmentsBySourceFile(clip.filePath)
      useScriptStore.getState().removeClipScript(clip.id)
    }
    set((state) => ({ clips: state.clips.filter((c) => c.id !== id) }))
  },

  setHighlightedClip: (id) => set({ highlightedClipId: id }),
}))
