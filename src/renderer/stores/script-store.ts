import { create } from 'zustand'
import type { ScriptSection, GenerationLog } from '@shared/types/ai'

interface VoiceoverEntry {
  filePath: string
  textHash: string
  stale: boolean
}

interface ScriptState {
  sections: ScriptSection[]
  clipScripts: Record<string, ScriptSection[]>
  voiceovers: Record<string, VoiceoverEntry>
  generationLog: GenerationLog | null
  setGenerationLog: (log: GenerationLog | null) => void
  setSections: (sections: ScriptSection[]) => void
  clearSections: () => void
  updateSection: (id: string, updates: Partial<ScriptSection>) => void
  setClipScript: (clipId: string, sections: ScriptSection[]) => void
  removeClipScript: (clipId: string) => void
  loadProjectScripts: (scripts: Array<{ clipId: string; sections: ScriptSection[] }>) => void
  assignEventToSection: (sectionId: string, eventId: string) => void
  removeEventFromSection: (sectionId: string, eventId: string) => void
  setFreezeOverride: (sectionId: string, duration: number | null) => void
  setVoiceover: (sectionId: string, filePath: string, textHash: string) => void
  markVoiceoverStale: (sectionId: string) => void
}

export const useScriptStore = create<ScriptState>((set, get) => ({
  sections: [],
  clipScripts: {},
  voiceovers: {},
  generationLog: null,
  setGenerationLog: (log) => set({ generationLog: log }),
  setSections: (sections) => set({ sections }),
  clearSections: () => set({ sections: [] }),
  updateSection: (id, updates) => {
    set((state) => ({
      sections: state.sections.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }))
    // Mark voiceover stale if text changed and a voiceover exists
    if (updates.text !== undefined) {
      const vo = get().voiceovers[id]
      if (vo) {
        set((state) => ({
          voiceovers: { ...state.voiceovers, [id]: { ...vo, stale: true } },
        }))
      }
    }
  },
  setClipScript: (clipId, sections) =>
    set((state) => ({
      clipScripts: { ...state.clipScripts, [clipId]: sections },
    })),
  removeClipScript: (clipId) =>
    set((state) => {
      const { [clipId]: _, ...rest } = state.clipScripts
      return { clipScripts: rest }
    }),
  loadProjectScripts: (scripts) =>
    set(() => ({
      clipScripts: Object.fromEntries(scripts.map((s) => [s.clipId, s.sections])),
    })),
  assignEventToSection: (sectionId, eventId) =>
    set((state) => ({
      sections: state.sections.map((s) => {
        if (s.id !== sectionId) return s
        const existing = s.eventIds ?? []
        if (existing.includes(eventId)) return s
        return { ...s, eventIds: [...existing, eventId] }
      }),
    })),
  removeEventFromSection: (sectionId, eventId) =>
    set((state) => ({
      sections: state.sections.map((s) => {
        if (s.id !== sectionId) return s
        return { ...s, eventIds: (s.eventIds ?? []).filter((id) => id !== eventId) }
      }),
    })),
  setFreezeOverride: (sectionId, duration) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === sectionId ? { ...s, freezeOverrideDuration: duration } : s,
      ),
    })),
  setVoiceover: (sectionId, filePath, textHash) =>
    set((state) => ({
      voiceovers: { ...state.voiceovers, [sectionId]: { filePath, textHash, stale: false } },
    })),
  markVoiceoverStale: (sectionId) =>
    set((state) => {
      const vo = state.voiceovers[sectionId]
      if (!vo) return state
      return { voiceovers: { ...state.voiceovers, [sectionId]: { ...vo, stale: true } } }
    }),
}))
