import { create } from 'zustand'
import type { ScriptSection } from '@shared/types/ai'

interface ScriptState {
  sections: ScriptSection[]
  clipScripts: Record<string, ScriptSection[]>
  setSections: (sections: ScriptSection[]) => void
  clearSections: () => void
  updateSection: (id: string, updates: Partial<ScriptSection>) => void
  setClipScript: (clipId: string, sections: ScriptSection[]) => void
  removeClipScript: (clipId: string) => void
  loadProjectScripts: (scripts: Array<{ clipId: string; sections: ScriptSection[] }>) => void
  assignEventToSection: (sectionId: string, eventId: string) => void
  removeEventFromSection: (sectionId: string, eventId: string) => void
  setFreezeOverride: (sectionId: string, duration: number | null) => void
}

export const useScriptStore = create<ScriptState>((set) => ({
  sections: [],
  clipScripts: {},
  setSections: (sections) => set({ sections }),
  clearSections: () => set({ sections: [] }),
  updateSection: (id, updates) =>
    set((state) => ({
      sections: state.sections.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
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
}))
