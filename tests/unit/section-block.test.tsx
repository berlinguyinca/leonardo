// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { SectionBlock } from '@renderer/components/script-editor/SectionBlock'
import type { ScriptSection } from '@shared/types'

function makeSection(overrides: Partial<ScriptSection> = {}): ScriptSection {
  return {
    id: 'sec-1',
    scriptId: 'script-1',
    text: 'Hello world narration text',
    voiceProfileId: null,
    startTime: 1000,
    endTime: 5000,
    timingMarkers: [],
    order: 0,
    ...overrides,
  }
}

const defaultProps = {
  isActive: false,
  onTextChange: vi.fn(),
  onVoiceChange: vi.fn(),
  onClick: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SectionBlock', () => {
  it('renders section number based on order', () => {
    const section = makeSection({ order: 2 })
    render(<SectionBlock section={section} {...defaultProps} />)
    expect(screen.getByText('Section 3')).toBeTruthy()
  })

  it('renders section text in the textarea', () => {
    const section = makeSection({ text: 'Narrate this content clearly' })
    const { container } = render(<SectionBlock section={section} {...defaultProps} />)
    const textarea = container.querySelector('textarea.section-block-text') as HTMLTextAreaElement
    expect(textarea).not.toBeNull()
    expect(textarea.value).toBe('Narrate this content clearly')
  })

  it('renders timing range from startTime and endTime', () => {
    // startTime=65000 → 1:05, endTime=125000 → 2:05
    const section = makeSection({ startTime: 65000, endTime: 125000 })
    render(<SectionBlock section={section} {...defaultProps} />)
    expect(screen.getByText('1:05 — 2:05')).toBeTruthy()
  })

  it('fires onTextChange callback when textarea changes', () => {
    const onTextChange = vi.fn()
    const section = makeSection()
    const { container } = render(
      <SectionBlock section={section} {...defaultProps} onTextChange={onTextChange} />,
    )
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'new text' } })
    expect(onTextChange).toHaveBeenCalledWith('new text')
  })

  it('fires onVoiceChange callback when voice select changes', () => {
    const onVoiceChange = vi.fn()
    const section = makeSection()
    const { container } = render(
      <SectionBlock section={section} {...defaultProps} onVoiceChange={onVoiceChange} />,
    )
    const select = container.querySelector('select.section-voice-select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '' } })
    expect(onVoiceChange).toHaveBeenCalledWith(null)
  })

  it('applies active CSS class when isActive is true', () => {
    const section = makeSection()
    const { container } = render(
      <SectionBlock section={section} {...defaultProps} isActive={true} />,
    )
    const block = container.querySelector('.section-block')
    expect(block?.classList.contains('active')).toBe(true)
  })

  it('does not apply active CSS class when isActive is false', () => {
    const section = makeSection()
    const { container } = render(
      <SectionBlock section={section} {...defaultProps} isActive={false} />,
    )
    const block = container.querySelector('.section-block')
    expect(block?.classList.contains('active')).toBe(false)
  })

  it('renders timing marker chips when timingMarkers are present', () => {
    const section = makeSection({
      timingMarkers: [
        { type: 'pause', position: 1000, duration: 2 },
        { type: 'zoom', position: 2000, selector: '#btn' },
      ],
    })
    const { container } = render(<SectionBlock section={section} {...defaultProps} />)
    const markers = container.querySelectorAll('.timing-marker-chip')
    expect(markers.length).toBe(2)
  })

  it('renders no timing marker chips when timingMarkers is empty', () => {
    const section = makeSection({ timingMarkers: [] })
    const { container } = render(<SectionBlock section={section} {...defaultProps} />)
    const markers = container.querySelectorAll('.timing-marker-chip')
    expect(markers.length).toBe(0)
  })
})
