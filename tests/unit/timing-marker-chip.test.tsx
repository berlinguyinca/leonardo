// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { TimingMarkerChip } from '@renderer/components/script-editor/TimingMarkerChip'
import type { TimingMarker } from '@shared/types'

describe('TimingMarkerChip', () => {
  it('renders PAUSE label with duration', () => {
    const marker: TimingMarker = { type: 'pause', position: 0, duration: 3 }
    const { container } = render(<TimingMarkerChip marker={marker} />)
    const chip = container.querySelector('.timing-marker-chip') as HTMLElement
    expect(chip).not.toBeNull()
    expect(chip.textContent).toBe('PAUSE 3s')
    expect(chip.title).toBe('PAUSE 3s')
  })

  it('renders ZOOM label with selector', () => {
    const marker: TimingMarker = { type: 'zoom', position: 500, selector: '#hero' }
    const { container } = render(<TimingMarkerChip marker={marker} />)
    const chip = container.querySelector('.timing-marker-chip') as HTMLElement
    expect(chip.textContent).toBe('ZOOM #hero')
    expect(chip.title).toBe('ZOOM #hero')
  })

  it('renders FREEZE label with duration', () => {
    const marker: TimingMarker = { type: 'freeze', position: 1000, duration: 5 }
    const { container } = render(<TimingMarkerChip marker={marker} />)
    const chip = container.querySelector('.timing-marker-chip') as HTMLElement
    expect(chip.textContent).toBe('FREEZE 5s')
    expect(chip.title).toBe('FREEZE 5s')
  })

  it('renders TRANSITION label with transitionType', () => {
    const marker: TimingMarker = { type: 'transition', position: 2000, transitionType: 'fade' }
    const { container } = render(<TimingMarkerChip marker={marker} />)
    const chip = container.querySelector('.timing-marker-chip') as HTMLElement
    expect(chip.textContent).toBe('TRANSITION fade')
    expect(chip.title).toBe('TRANSITION fade')
  })
})
