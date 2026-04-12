import { useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { StoryboardStep } from '@shared/types/events'
import type { AIProviderType } from '@shared/types/ai'
import type { TransitionType } from '@shared/types/timeline'
import { useComposeStore } from '../../stores/compose-store'

interface StepCardProps {
  step: StoryboardStep
  isSelected: boolean
  onSelect: () => void
  providerOverride?: AIProviderType
  onProviderChange?: (provider: AIProviderType | null) => void
}

const STEP_TYPE_COLORS: Record<string, string> = {
  intro: '#22c55e',
  step: '#4a9eff',
  outro: '#f59e0b',
}

const TRANSITION_OPTIONS: TransitionType[] = ['cut', 'fade', 'dissolve', 'wipe']
const PROVIDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'ollama', label: 'Ollama' },
]

export function StepCard({
  step,
  isSelected,
  onSelect,
  providerOverride,
  onProviderChange,
}: StepCardProps): React.ReactNode {
  const updateStep = useComposeStore((s) => s.updateStep)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: step.id,
    data: { type: 'step-reorder', stepId: step.id },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isSelected ? '#1d4a8a' : '#1a1a1a',
    border: `1px solid ${isSelected ? '#4a9eff' : '#333'}`,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }

  const handleTransitionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateStep(step.id, { transitionType: e.target.value as TransitionType })
    },
    [step.id, updateStep],
  )

  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value
      onProviderChange?.(value === 'inherit' ? null : (value as AIProviderType))
    },
    [onProviderChange],
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`step-card ${isSelected ? 'selected' : ''}`}
      data-step-id={step.id}
      {...attributes}
    >
      {/* Header row: type badge + drag handle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          className="step-type-badge"
          style={{
            background: STEP_TYPE_COLORS[step.type] ?? '#4a9eff',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          {step.type}
        </span>
        <span
          ref={setActivatorNodeRef}
          className="drag-handle"
          style={{ cursor: 'grab', color: '#555', marginLeft: 'auto', userSelect: 'none' }}
          {...listeners}
        >
          &#x2630;
        </span>
      </div>

      {/* Event chips */}
      {step.eventIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {step.eventIds.map((eid) => (
            <span
              key={eid}
              className="step-event-badge"
              style={{
                background: '#333',
                color: '#d0d0d0',
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 8,
              }}
            >
              {eid.slice(0, 8)}
            </span>
          ))}
        </div>
      )}

      {/* Transition selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ color: '#888', fontSize: 11 }}>Transition</label>
        <select
          className="transition-select"
          value={step.transitionType}
          onChange={handleTransitionChange}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#252525',
            color: '#d0d0d0',
            border: '1px solid #333',
            borderRadius: 4,
            padding: '2px 4px',
            fontSize: 11,
          }}
        >
          {TRANSITION_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Script placeholder */}
      <p
        className="script-placeholder"
        style={{
          color: '#888',
          fontSize: 11,
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {step.scriptPlaceholder || 'No script yet...'}
      </p>

      {/* Provider override */}
      {onProviderChange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ color: '#888', fontSize: 11 }}>Provider</label>
          <select
            className="provider-select"
            value={providerOverride ?? 'inherit'}
            onChange={handleProviderChange}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#252525',
              color: '#d0d0d0',
              border: '1px solid #333',
              borderRadius: 4,
              padding: '2px 4px',
              fontSize: 11,
            }}
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
