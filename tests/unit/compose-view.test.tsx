// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Mock child components to isolate ComposeView layout tests
vi.mock('../../src/renderer/components/compose/StoryboardPanel', () => ({
  StoryboardPanel: () => <div data-testid="storyboard-panel">StoryboardPanel</div>,
}))

vi.mock('../../src/renderer/components/preview/PlaybackPanel', () => ({
  PlaybackPanel: () => <div data-testid="playback-panel">PlaybackPanel</div>,
}))

import { ComposeView } from '../../src/renderer/components/compose/ComposeView'

describe('ComposeView', () => {
  it('renders StoryboardPanel', () => {
    const { getByTestId } = render(<ComposeView />)
    expect(getByTestId('storyboard-panel')).toBeTruthy()
  })

  it('renders with resize divider', () => {
    const { container } = render(<ComposeView />)
    const divider = container.querySelector('.compose-resize-divider')
    expect(divider).toBeTruthy()
  })

  it('has correct layout structure', () => {
    const { container } = render(<ComposeView />)
    const view = container.querySelector('.compose-view')
    expect(view).toBeTruthy()

    const left = container.querySelector('.compose-left')
    const right = container.querySelector('.compose-right')
    expect(left).toBeTruthy()
    expect(right).toBeTruthy()

    // Left is ~40%, right is ~60%
    expect((left as HTMLElement).style.width).toBe('40%')
    expect((right as HTMLElement).style.width).toBe('60%')
  })
})
