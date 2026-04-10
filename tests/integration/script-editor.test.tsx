// @vitest-environment jsdom
// tests/integration/script-editor.test.tsx
import { describe, it, expect } from 'vitest'
import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionBlock } from '@renderer/components/script-editor/SectionBlock'
import { TimingMarkerChip } from '@renderer/components/script-editor/TimingMarkerChip'
import type { ScriptSection, TimingMarker } from '@shared/types'

function makeSection(overrides: Partial<ScriptSection> = {}): ScriptSection {
  return {
    id: 'sec-1',
    scriptId: 'script-1',
    text: 'Welcome to this tutorial',
    voiceProfileId: null,
    startTime: 0,
    endTime: 5000,
    timingMarkers: [],
    order: 0,
    ...overrides,
  }
}

describe('SectionBlock (integration)', () => {
  it('renders section text and order', () => {
    render(
      <SectionBlock
        section={makeSection()}
        isActive={false}
        onTextChange={() => {}}
        onVoiceChange={() => {}}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('Section 1')).toBeDefined()
    expect(screen.getByDisplayValue('Welcome to this tutorial')).toBeDefined()
  })

  it('calls onTextChange when text is edited', () => {
    const onTextChange = vi.fn()
    render(
      <SectionBlock
        section={makeSection()}
        isActive={false}
        onTextChange={onTextChange}
        onVoiceChange={() => {}}
        onClick={() => {}}
      />,
    )
    const textarea = screen.getByDisplayValue('Welcome to this tutorial')
    fireEvent.change(textarea, { target: { value: 'Updated text' } })
    expect(onTextChange).toHaveBeenCalledWith('Updated text')
  })

  it('calls onClick when section block is clicked', () => {
    const onClick = vi.fn()
    render(
      <SectionBlock
        section={makeSection()}
        isActive={false}
        onTextChange={() => {}}
        onVoiceChange={() => {}}
        onClick={onClick}
      />,
    )
    fireEvent.click(screen.getByText('Section 1'))
    expect(onClick).toHaveBeenCalled()
  })

  it('shows active styling when isActive is true', () => {
    const { container } = render(
      <SectionBlock
        section={makeSection()}
        isActive={true}
        onTextChange={() => {}}
        onVoiceChange={() => {}}
        onClick={() => {}}
      />,
    )
    const block = container.querySelector('.section-block')
    expect(block?.classList.contains('active')).toBe(true)
  })

  it('renders timing markers when present', () => {
    const markers: TimingMarker[] = [
      { type: 'pause', position: 100, duration: 1.5 },
      { type: 'zoom', position: 200, selector: '.btn' },
    ]
    render(
      <SectionBlock
        section={makeSection({ timingMarkers: markers })}
        isActive={false}
        onTextChange={() => {}}
        onVoiceChange={() => {}}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('PAUSE 1.5s')).toBeDefined()
    expect(screen.getByText('ZOOM .btn')).toBeDefined()
  })
})

describe('TimingMarkerChip', () => {
  it('renders pause marker', () => {
    render(<TimingMarkerChip marker={{ type: 'pause', position: 0, duration: 2 }} />)
    expect(screen.getByText('PAUSE 2s')).toBeDefined()
  })

  it('renders freeze marker', () => {
    render(<TimingMarkerChip marker={{ type: 'freeze', position: 0, duration: 3 }} />)
    expect(screen.getByText('FREEZE 3s')).toBeDefined()
  })

  it('renders zoom marker with selector', () => {
    render(<TimingMarkerChip marker={{ type: 'zoom', position: 0, selector: '#submit' }} />)
    expect(screen.getByText('ZOOM #submit')).toBeDefined()
  })

  it('renders transition marker', () => {
    render(<TimingMarkerChip marker={{ type: 'transition', position: 0, transitionType: 'fade' }} />)
    expect(screen.getByText('TRANSITION fade')).toBeDefined()
  })
})
