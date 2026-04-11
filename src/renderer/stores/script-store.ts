import { create } from 'zustand'
import type { ScriptSection } from '@shared/types/ai'

interface ScriptState {
  sections: ScriptSection[]
  clipScripts: Record<string, ScriptSection[]>
  setSections: (sections: ScriptSection[]) => void
  clearSections: () => void
  updateSection: (id: string, updates: Partial<ScriptSection>) => void
  setClipScript: (clipId: string, sections: ScriptSection[]) => void
  loadProjectScripts: (scripts: Array<{ clipId: string; sections: ScriptSection[] }>) => void
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
  loadProjectScripts: (scripts) =>
    set(() => ({
      clipScripts: Object.fromEntries(scripts.map((s) => [s.clipId, s.sections])),
    })),
}))
