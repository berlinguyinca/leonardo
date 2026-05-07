// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { StoryboardStep } from '@shared/types/events'
import { useComposeStore } from '../../src/renderer/stores/compose-store'
import { StoryboardPanel } from '../../src/renderer/components/compose/StoryboardPanel'

function makeStep(overrides?: Partial<StoryboardStep>): StoryboardStep {
  return {
    id: `step-${Math.random().toString(36).slice(2, 8)}`,
    type: 'step',
    segmentId: null,
    eventIds: [],
    transitionType: 'cut',
    scriptPlaceholder: 'Do something',
    order: 0,
    ...overrides,
  }
}

// Mock PlaybackPanel since it depends on heavy Electron/video deps
vi.mock('../../src/renderer/components/preview/PlaybackPanel', () => ({
  PlaybackPanel: () => <div data-testid="playback-panel">PlaybackPanel</div>,
}))

describe('StoryboardPanel', () => {
  beforeEach(() => {
    useComposeStore.setState({
      steps: [],
      selectedStepId: null,
      stepProviderOverrides: {},
    })
  })

  it('renders list of StepCards', () => {
    const steps = [
      makeStep({ id: 's1', scriptPlaceholder: 'Step one' }),
      makeStep({ id: 's2', scriptPlaceholder: 'Step two' }),
      makeStep({ id: 's3', scriptPlaceholder: 'Step three' }),
    ]
    useComposeStore.setState({ steps })

    const { container } = render(<StoryboardPanel />)
    const cards = container.querySelectorAll('.step-card')
    expect(cards.length).toBe(3)
  })

  it('shows "Add Intro" button', () => {
    render(<StoryboardPanel />)
    expect(screen.getByText('Add Intro')).toBeTruthy()
  })

  it('shows "Add Outro" button', () => {
    render(<StoryboardPanel />)
    expect(screen.getByText('Add Outro')).toBeTruthy()
  })

  it('Add Intro creates intro step at position 0', () => {
    const existingStep = makeStep({ id: 'existing', order: 0 })
    useComposeStore.setState({ steps: [existingStep] })

    render(<StoryboardPanel />)
    fireEvent.click(screen.getByText('Add Intro'))

    const steps = useComposeStore.getState().steps
    expect(steps.length).toBe(2)
    const introStep = steps.find((s) => s.type === 'intro')
    expect(introStep).toBeTruthy()
    expect(introStep!.type).toBe('intro')
  })

  it('Add Outro creates outro step at last position', () => {
    const existingStep = makeStep({ id: 'existing', order: 0 })
    useComposeStore.setState({ steps: [existingStep] })

    render(<StoryboardPanel />)
    fireEvent.click(screen.getByText('Add Outro'))

    const steps = useComposeStore.getState().steps
    expect(steps.length).toBe(2)
    const outroStep = steps.find((s) => s.type === 'outro')
    expect(outroStep).toBeTruthy()
    expect(outroStep!.type).toBe('outro')
  })
})
