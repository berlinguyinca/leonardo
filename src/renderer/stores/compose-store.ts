import { create } from 'zustand'
import { temporal } from 'zundo'
import type { StoryboardStep } from '@shared/types/events'
import type { AIProviderType, GenerationLogEntry } from '@shared/types/ai'
import { UNDO_HISTORY_LIMIT } from '@shared/constants'

interface ComposeState {
  steps: StoryboardStep[]
  selectedStepId: string | null
  aiProvider: AIProviderType
  stepProviderOverrides: Record<string, AIProviderType>
  generationLog: GenerationLogEntry[]
  isGenerating: boolean
  _syncing: boolean

  // Actions
  setSteps: (steps: StoryboardStep[]) => void
  addStep: (step: StoryboardStep) => void
  removeStep: (id: string) => void
  reorderSteps: (fromIndex: number, toIndex: number) => void
  updateStep: (id: string, updates: Partial<StoryboardStep>) => void
  setSelectedStep: (id: string | null) => void
  setAIProvider: (provider: AIProviderType) => void
  setStepProviderOverride: (stepId: string, provider: AIProviderType) => void
  clearStepProviderOverride: (stepId: string) => void
  appendLogEntry: (entry: GenerationLogEntry) => void
  clearLog: () => void
  setIsGenerating: (generating: boolean) => void
  syncFromTimeline: (
    segments: Array<{ id: string; label: string; startTime: number; endTime: number }>,
    domEvents: Record<string, string[]>,
  ) => void
  syncToTimeline: () => StoryboardStep[]
}

export const useComposeStore = create<ComposeState>()(
  temporal(
    (set, get) => ({
      steps: [],
      selectedStepId: null,
      aiProvider: 'claude',
      stepProviderOverrides: {},
      generationLog: [],
      isGenerating: false,
      _syncing: false,

      setSteps: (steps) => set({ steps }),

      addStep: (step) =>
        set((state) => ({
          steps: [...state.steps, step],
        })),

      removeStep: (id) =>
        set((state) => ({
          steps: state.steps.filter((s) => s.id !== id),
          selectedStepId: state.selectedStepId === id ? null : state.selectedStepId,
        })),

      reorderSteps: (fromIndex, toIndex) =>
        set((state) => {
          const steps = [...state.steps]
          const [moved] = steps.splice(fromIndex, 1)
          steps.splice(toIndex, 0, moved)
          return {
            steps: steps.map((s, i) => ({ ...s, order: i })),
          }
        }),

      updateStep: (id, updates) =>
        set((state) => ({
          steps: state.steps.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),

      setSelectedStep: (id) => set({ selectedStepId: id }),

      setAIProvider: (provider) => set({ aiProvider: provider }),

      setStepProviderOverride: (stepId, provider) =>
        set((state) => ({
          stepProviderOverrides: { ...state.stepProviderOverrides, [stepId]: provider },
        })),

      clearStepProviderOverride: (stepId) =>
        set((state) => {
          const overrides = { ...state.stepProviderOverrides }
          delete overrides[stepId]
          return { stepProviderOverrides: overrides }
        }),

      appendLogEntry: (entry) =>
        set((state) => ({
          generationLog: [...state.generationLog, entry],
        })),

      clearLog: () => set({ generationLog: [] }),

      setIsGenerating: (generating) => set({ isGenerating: generating }),

      syncFromTimeline: (segments, domEvents) => {
        if (get()._syncing) return
        set({ _syncing: true })
        try {
          const steps: StoryboardStep[] = segments.map((seg, i) => ({
            id: seg.id,
            type: 'step',
            segmentId: seg.id,
            eventIds: domEvents[seg.id] ?? [],
            transitionType: 'cut',
            scriptPlaceholder: seg.label,
            order: i,
          }))
          set({ steps })
        } finally {
          set({ _syncing: false })
        }
      },

      syncToTimeline: () => get().steps,
    }),
    { limit: UNDO_HISTORY_LIMIT },
  ),
)
