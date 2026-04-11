import { create } from 'zustand'
import type { ScriptSection } from '@shared/types/ai'

interface ScriptState {
  sections: ScriptSection[]
  setSections: (sections: ScriptSection[]) => void
  clearSections: () => void
  updateSection: (id: string, updates: Partial<ScriptSection>) => void
}

export const useScriptStore = create<ScriptState>((set) => ({
  sections: [],
  setSections: (sections) => set({ sections }),
  clearSections: () => set({ sections: [] }),
  updateSection: (id, updates) =>
    set((state) => ({
      sections: state.sections.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
}))
