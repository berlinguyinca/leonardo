import { create } from 'zustand'
import type { Clip } from '@shared/types/events'

interface LibraryState {
  clips: Clip[]
  highlightedClipId: string | null

  loadClips: () => Promise<void>
  addClip: (clip: Clip) => Promise<void>
  removeClip: (id: string) => Promise<void>
  setHighlightedClip: (id: string | null) => void
}

function hasBridge(): boolean {
  return typeof window !== 'undefined' && !!window.leonardo?.clip
}

export const useLibraryStore = create<LibraryState>((set) => ({
  clips: [],
  highlightedClipId: null,

  loadClips: async () => {
    if (!hasBridge()) return
    const clips = await window.leonardo.clip.list()
    set({ clips })
  },

  addClip: async (clip) => {
    if (hasBridge()) {
      await window.leonardo.clip.create(clip)
    }
    set((state) => ({ clips: [clip, ...state.clips] }))
  },

  removeClip: async (id) => {
    if (hasBridge()) {
      await window.leonardo.clip.delete(id)
    }
    set((state) => ({ clips: state.clips.filter((c) => c.id !== id) }))
  },

  setHighlightedClip: (id) => set({ highlightedClipId: id }),
}))
