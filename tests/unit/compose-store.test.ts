// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { useComposeStore } from '../../src/renderer/stores/compose-store'
import type { StoryboardStep } from '@shared/types/events'
import type { AIProviderType, GenerationLogEntry } from '@shared/types/ai'

function makeStep(overrides: Partial<StoryboardStep> = {}): StoryboardStep {
  return {
    id: 'step-1',
    type: 'step',
    segmentId: 'seg-1',
    eventIds: [],
    transitionType: 'cut',
    scriptPlaceholder: 'Do something',
    order: 0,
    ...overrides,
  }
}

describe('compose-store', () => {
  beforeEach(() => {
    useComposeStore.setState({
      steps: [],
      selectedStepId: null,
      aiProvider: 'claude',
      stepProviderOverrides: {},
      generationLog: [],
      isGenerating: false,
      _syncing: false,
    })
  })

  it('addStep creates a step', () => {
    const step = makeStep()
    useComposeStore.getState().addStep(step)

    const steps = useComposeStore.getState().steps
    expect(steps).toHaveLength(1)
    expect(steps[0]).toEqual(step)
  })

  it('removeStep removes by id', () => {
    const step = makeStep()
    useComposeStore.getState().addStep(step)
    useComposeStore.getState().removeStep('step-1')

    expect(useComposeStore.getState().steps).toHaveLength(0)
  })

  it('removeStep clears selectedStepId when the selected step is removed', () => {
    const step = makeStep()
    useComposeStore.getState().addStep(step)
    useComposeStore.setState({ selectedStepId: 'step-1' })
    useComposeStore.getState().removeStep('step-1')

    expect(useComposeStore.getState().selectedStepId).toBeNull()
  })

  it('reorderSteps moves item and updates order fields', () => {
    const stepA = makeStep({ id: 'a', order: 0 })
    const stepB = makeStep({ id: 'b', order: 1 })
    const stepC = makeStep({ id: 'c', order: 2 })
    useComposeStore.setState({ steps: [stepA, stepB, stepC] })

    // Move 'a' (index 0) to index 2
    useComposeStore.getState().reorderSteps(0, 2)

    const steps = useComposeStore.getState().steps
    expect(steps.map((s) => s.id)).toEqual(['b', 'c', 'a'])
    expect(steps.map((s) => s.order)).toEqual([0, 1, 2])
  })

  it('updateStep partially updates a step', () => {
    const step = makeStep({ scriptPlaceholder: 'Original' })
    useComposeStore.getState().addStep(step)
    useComposeStore.getState().updateStep('step-1', { scriptPlaceholder: 'Updated' })

    const updated = useComposeStore.getState().steps[0]
    expect(updated.scriptPlaceholder).toBe('Updated')
    // Other fields unchanged
    expect(updated.type).toBe('step')
    expect(updated.segmentId).toBe('seg-1')
  })

  it('setAIProvider changes the global default', () => {
    expect(useComposeStore.getState().aiProvider).toBe('claude')
    useComposeStore.getState().setAIProvider('ollama' as AIProviderType)
    expect(useComposeStore.getState().aiProvider).toBe('ollama')
  })

  it('setStepProviderOverride sets per-step override', () => {
    useComposeStore.getState().setStepProviderOverride('step-1', 'ollama' as AIProviderType)

    expect(useComposeStore.getState().stepProviderOverrides['step-1']).toBe('ollama')
  })

  it('clearStepProviderOverride removes override', () => {
    useComposeStore.getState().setStepProviderOverride('step-1', 'ollama' as AIProviderType)
    useComposeStore.getState().clearStepProviderOverride('step-1')

    expect(useComposeStore.getState().stepProviderOverrides['step-1']).toBeUndefined()
    expect(Object.keys(useComposeStore.getState().stepProviderOverrides)).toHaveLength(0)
  })

  it('appendLogEntry adds to generationLog', () => {
    const entry: GenerationLogEntry = {
      timestamp: Date.now(),
      level: 'info',
      message: 'Generation started',
    }
    useComposeStore.getState().appendLogEntry(entry)

    const log = useComposeStore.getState().generationLog
    expect(log).toHaveLength(1)
    expect(log[0]).toEqual(entry)
  })

  it('clearLog empties the log', () => {
    const entry: GenerationLogEntry = {
      timestamp: Date.now(),
      level: 'warn',
      message: 'Something happened',
    }
    useComposeStore.getState().appendLogEntry(entry)
    useComposeStore.getState().clearLog()

    expect(useComposeStore.getState().generationLog).toHaveLength(0)
  })

  it('syncFromTimeline creates steps from segments', () => {
    const segments = [
      { id: 'seg-a', label: 'Intro clip', startTime: 0, endTime: 5000 },
      { id: 'seg-b', label: 'Main step', startTime: 5000, endTime: 12000 },
    ]
    const domEvents: Record<string, string[]> = {
      'seg-a': ['evt-1', 'evt-2'],
      'seg-b': [],
    }

    useComposeStore.getState().syncFromTimeline(segments, domEvents)

    const steps = useComposeStore.getState().steps
    expect(steps).toHaveLength(2)
    expect(steps[0].id).toBe('seg-a')
    expect(steps[0].segmentId).toBe('seg-a')
    expect(steps[0].eventIds).toEqual(['evt-1', 'evt-2'])
    expect(steps[0].scriptPlaceholder).toBe('Intro clip')
    expect(steps[0].order).toBe(0)
    expect(steps[1].id).toBe('seg-b')
    expect(steps[1].order).toBe(1)
    expect(steps[1].eventIds).toEqual([])
  })

  it('syncFromTimeline returns early when _syncing is true', () => {
    useComposeStore.setState({ _syncing: true, steps: [] })
    const segments = [{ id: 'seg-x', label: 'Should not appear', startTime: 0, endTime: 1000 }]

    useComposeStore.getState().syncFromTimeline(segments, {})

    // Steps should remain empty because _syncing guard fired
    expect(useComposeStore.getState().steps).toHaveLength(0)
    // _syncing stays true (we set it externally, guard returned early before resetting)
    expect(useComposeStore.getState()._syncing).toBe(true)
  })

  it('syncToTimeline returns the current steps array', () => {
    const step = makeStep()
    useComposeStore.getState().addStep(step)

    const result = useComposeStore.getState().syncToTimeline()

    expect(result).toEqual(useComposeStore.getState().steps)
    expect(result).toHaveLength(1)
  })

  it('setSteps replaces the steps array', () => {
    useComposeStore.getState().addStep(makeStep({ id: 'old' }))
    const newSteps = [makeStep({ id: 'new-1' }), makeStep({ id: 'new-2' })]
    useComposeStore.getState().setSteps(newSteps)

    expect(useComposeStore.getState().steps).toEqual(newSteps)
  })
})
