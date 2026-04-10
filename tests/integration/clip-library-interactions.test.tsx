// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useLibraryStore } from '@renderer/stores/library-store'
import { useTimelineStore } from '@renderer/stores/timeline-store'
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

describe('ClipLibrary interactions (integration)', () => {
  let addClipToTimelineMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addClipToTimelineMock = vi.fn()
    useTimelineStore.setState({ addClipToTimeline: addClipToTimelineMock } as any)
    useLibraryStore.setState({
      clips: [],
      highlightedClipId: null,
    })
  })

  describe('double-click', () => {
    it('calls addClipToTimeline with the correct clip on double-click', () => {
      const clip = makeClip()
      useLibraryStore.getState().addClip(clip)

      render(<ClipLibrary />)

      const card = screen.getByText('Recording 1').closest('.clip-card')!
      fireEvent.dblClick(card)

      expect(addClipToTimelineMock).toHaveBeenCalledOnce()
      expect(addClipToTimelineMock).toHaveBeenCalledWith(clip)
    })

    it('does NOT call addClipToTimeline on single click', () => {
      const clip = makeClip()
      useLibraryStore.getState().addClip(clip)

      render(<ClipLibrary />)

      const card = screen.getByText('Recording 1').closest('.clip-card')!
      fireEvent.click(card)

      expect(addClipToTimelineMock).not.toHaveBeenCalled()
    })
  })

  describe('drag-and-drop', () => {
    it('sets application/clip-id in dataTransfer on drag start', () => {
      const clip = makeClip({ id: 'clip-abc' })
      useLibraryStore.getState().addClip(clip)

      render(<ClipLibrary />)

      const card = screen.getByText('Recording 1').closest('.clip-card')!
      const mockDataTransfer = { setData: vi.fn(), effectAllowed: '' }

      fireEvent.dragStart(card, { dataTransfer: mockDataTransfer })

      expect(mockDataTransfer.setData).toHaveBeenCalledWith('application/clip-id', 'clip-abc')
    })

    it('sets effectAllowed to "copy" on drag start', () => {
      const clip = makeClip({ id: 'clip-abc' })
      useLibraryStore.getState().addClip(clip)

      render(<ClipLibrary />)

      const card = screen.getByText('Recording 1').closest('.clip-card')!
      const mockDataTransfer = { setData: vi.fn(), effectAllowed: '' }

      fireEvent.dragStart(card, { dataTransfer: mockDataTransfer })

      expect(mockDataTransfer.effectAllowed).toBe('copy')
    })
  })
})
