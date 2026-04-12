// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { StoryboardStep } from '@shared/types/events'
import { useComposeStore } from '../../src/renderer/stores/compose-store'
import { StepCard } from '../../src/renderer/components/compose/StepCard'

function makeStep(overrides?: Partial<StoryboardStep>): StoryboardStep {
  return {
    id: 'step-1',
    type: 'step',
    segmentId: null,
    eventIds: [],
    transitionType: 'cut',
    scriptPlaceholder: 'Click the button',
    order: 0,
    ...overrides,
  }
}

function renderCard(
  step: StoryboardStep,
  props?: {
    isSelected?: boolean
    onSelect?: () => void
    providerOverride?: 'claude' | 'codex' | 'ollama' | 'openai'
    onProviderChange?: (p: 'claude' | 'codex' | 'ollama' | 'openai' | null) => void
  },
) {
  const merged = {
    isSelected: false,
    onSelect: vi.fn(),
    ...props,
  }
  return render(
    <DndContext>
      <SortableContext items={[step.id]} strategy={verticalListSortingStrategy}>
        <StepCard step={step} {...merged} />
      </SortableContext>
    </DndContext>,
  )
}

describe('StepCard', () => {
  beforeEach(() => {
    useComposeStore.setState({ steps: [] })
  })

  it('renders step type badge', () => {
    renderCard(makeStep({ type: 'intro' }))
    expect(screen.getByText('intro')).toBeTruthy()
  })

  it('renders transition selector', () => {
    renderCard(makeStep({ transitionType: 'fade' }))
    const select = screen.getByDisplayValue('fade')
    expect(select).toBeTruthy()
    expect(select.tagName.toLowerCase()).toBe('select')
  })

  it('renders script placeholder text', () => {
    renderCard(makeStep({ scriptPlaceholder: 'Navigate to settings' }))
    expect(screen.getByText('Navigate to settings')).toBeTruthy()
  })

  it('shows selected state when isSelected=true', () => {
    const { container } = renderCard(makeStep(), { isSelected: true })
    const card = container.querySelector('.step-card')!
    expect(card.classList.contains('selected')).toBe(true)
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    const { container } = renderCard(makeStep(), { onSelect })
    const card = container.querySelector('.step-card')!
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('shows provider override dropdown', () => {
    const onProviderChange = vi.fn()
    renderCard(makeStep(), { providerOverride: 'claude', onProviderChange })
    const select = screen.getByDisplayValue('Claude')
    expect(select).toBeTruthy()
  })
})
