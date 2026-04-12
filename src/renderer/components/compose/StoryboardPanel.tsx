import { useCallback } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useComposeStore } from '../../stores/compose-store'
import { StepCard } from './StepCard'

export function StoryboardPanel(): React.ReactNode {
  const steps = useComposeStore((s) => s.steps)
  const selectedStepId = useComposeStore((s) => s.selectedStepId)
  const setSelectedStep = useComposeStore((s) => s.setSelectedStep)
  const addStep = useComposeStore((s) => s.addStep)
  const reorderSteps = useComposeStore((s) => s.reorderSteps)
  const updateStep = useComposeStore((s) => s.updateStep)
  const stepProviderOverrides = useComposeStore((s) => s.stepProviderOverrides)
  const setStepProviderOverride = useComposeStore((s) => s.setStepProviderOverride)
  const clearStepProviderOverride = useComposeStore((s) => s.clearStepProviderOverride)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return

      const dragType = (active.data.current as { type?: string })?.type

      if (dragType === 'step-reorder') {
        if (active.id === over.id) return
        const oldIndex = steps.findIndex((s) => s.id === active.id)
        const newIndex = steps.findIndex((s) => s.id === over.id)
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderSteps(oldIndex, newIndex)
        }
      } else if (dragType === 'event-chip') {
        const eventId = (active.data.current as { eventId?: string })?.eventId
        const targetStep = steps.find((s) => s.id === over.id)
        if (eventId && targetStep) {
          updateStep(targetStep.id, {
            eventIds: [...targetStep.eventIds, eventId],
          })
        }
      }
    },
    [steps, reorderSteps, updateStep],
  )

  const handleAddIntro = useCallback(() => {
    addStep({
      id: `intro-${Date.now()}`,
      type: 'intro',
      segmentId: null,
      eventIds: [],
      transitionType: 'fade',
      scriptPlaceholder: 'Introduction',
      order: 0,
    })
  }, [addStep])

  const handleAddOutro = useCallback(() => {
    addStep({
      id: `outro-${Date.now()}`,
      type: 'outro',
      segmentId: null,
      eventIds: [],
      transitionType: 'fade',
      scriptPlaceholder: 'Conclusion',
      order: steps.length,
    })
  }, [addStep, steps.length])

  const handleProviderChange = useCallback(
    (stepId: string, provider: import('@shared/types/ai').AIProviderType | null) => {
      if (provider) {
        setStepProviderOverride(stepId, provider)
      } else {
        clearStepProviderOverride(stepId)
      }
    },
    [setStepProviderOverride, clearStepProviderOverride],
  )

  return (
    <div
      className="storyboard-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#161616',
        color: '#d0d0d0',
      }}
    >
      {/* Header with action buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: '1px solid #252525',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 12 }}>Storyboard</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="add-intro-btn"
            onClick={handleAddIntro}
            style={{
              background: '#252525',
              color: '#d0d0d0',
              border: '1px solid #333',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Add Intro
          </button>
          <button
            className="add-outro-btn"
            onClick={handleAddOutro}
            style={{
              background: '#252525',
              color: '#d0d0d0',
              border: '1px solid #333',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Add Outro
          </button>
        </div>
      </div>

      {/* Sortable step list */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {steps.map((step) => (
              <StepCard
                key={step.id}
                step={step}
                isSelected={selectedStepId === step.id}
                onSelect={() => setSelectedStep(step.id)}
                providerOverride={stepProviderOverrides[step.id]}
                onProviderChange={(provider) => handleProviderChange(step.id, provider)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {steps.length === 0 && (
          <div style={{ color: '#555', fontSize: 12, textAlign: 'center', padding: 20 }}>
            No steps yet. Add an intro or sync from the timeline.
          </div>
        )}
      </div>
    </div>
  )
}
