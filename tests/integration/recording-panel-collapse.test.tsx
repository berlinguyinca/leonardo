// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useLibraryStore } from '@renderer/stores/library-store'
import { ClipLibrary } from '@renderer/components/clip-library/ClipLibrary'
import type { Clip } from '@shared/types/events'

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    projectId: 'proj-1',
    filePath: '/recordings/clip-1/recording.webm',
    duration: 65000,
    url: 'https://example.com/page',
    resolution: { width: 1920, height: 1080 },
    createdAt: '2026-04-10T12:00:00Z',
    label: 'Recording 1',
    ...overrides,
  }
}

describe('recording panel collapse (integration)', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarCollapsed: false,
      propertiesCollapsed: false,
      timelineCollapsed: false,
      panelStateBeforeRecording: null,
    })
    useLibraryStore.setState({
      clips: [],
      highlightedClipId: null,
    })
  })

  describe('panel collapse/restore cycle', () => {
    it('collapseAllPanels collapses all panels and saves snapshot', () => {
      useUIStore.getState().collapseAllPanels()

      const state = useUIStore.getState()
      expect(state.sidebarCollapsed).toBe(true)
      expect(state.propertiesCollapsed).toBe(true)
      expect(state.timelineCollapsed).toBe(true)
      expect(state.panelStateBeforeRecording).toEqual({
        sidebarCollapsed: false,
        propertiesCollapsed: false,
        timelineCollapsed: false,
      })
    })

    it('restorePanelState restores panels and clears snapshot', () => {
      useUIStore.getState().collapseAllPanels()
      useUIStore.getState().restorePanelState()

      const state = useUIStore.getState()
      expect(state.sidebarCollapsed).toBe(false)
      expect(state.propertiesCollapsed).toBe(false)
      expect(state.timelineCollapsed).toBe(false)
      expect(state.panelStateBeforeRecording).toBeNull()
    })

    it('preserves pre-existing collapsed state through the cycle', () => {
      // Timeline was already collapsed before recording
      useUIStore.getState().setTimelineCollapsed(true)
      useUIStore.getState().collapseAllPanels()
      useUIStore.getState().restorePanelState()

      const state = useUIStore.getState()
      expect(state.sidebarCollapsed).toBe(false)
      expect(state.propertiesCollapsed).toBe(false)
      expect(state.timelineCollapsed).toBe(true) // stays collapsed
    })
  })

  describe('ClipLibrary component', () => {
    it('shows empty state when no clips', () => {
      render(<ClipLibrary />)
      expect(screen.getByText('No clips yet. Start recording to add clips.')).toBeDefined()
    })

    it('renders clips with label and duration', () => {
      useLibraryStore.getState().addClip(makeClip())
      render(<ClipLibrary />)

      expect(screen.getByText('Recording 1')).toBeDefined()
      expect(screen.getByText('01:05')).toBeDefined()
    })

    it('renders multiple clips newest first', () => {
      useLibraryStore.getState().addClip(makeClip({ id: 'clip-1', label: 'Recording 1' }))
      useLibraryStore.getState().addClip(makeClip({ id: 'clip-2', label: 'Recording 2' }))

      render(<ClipLibrary />)
      const labels = screen.getAllByText(/Recording \d/)
      expect(labels[0].textContent).toBe('Recording 2')
      expect(labels[1].textContent).toBe('Recording 1')
    })

    it('highlights the newest clip', () => {
      useLibraryStore.getState().addClip(makeClip())
      useLibraryStore.getState().setHighlightedClip('clip-1')

      const { container } = render(<ClipLibrary />)
      const highlighted = container.querySelector('.clip-highlighted')
      expect(highlighted).not.toBeNull()
    })

    it('shows truncated URL for long URLs', () => {
      useLibraryStore.getState().addClip(
        makeClip({ url: 'https://example.com/very/long/path/that/should/be/truncated' }),
      )
      render(<ClipLibrary />)

      expect(screen.getByText('https://example.com/very/lo...')).toBeDefined()
    })
  })
})
