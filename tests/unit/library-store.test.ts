import { describe, it, expect, beforeEach } from 'vitest'
import { useLibraryStore } from '../../src/renderer/stores/library-store'
import type { Clip } from '@shared/types/events'

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    projectId: 'proj-1',
    filePath: '/recordings/clip-1/recording.webm',
    duration: 5000,
    url: 'https://example.com',
    resolution: { width: 1920, height: 1080 },
    createdAt: '2026-04-10T12:00:00Z',
    label: 'Recording 1',
    ...overrides,
  }
}

describe('library-store', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      clips: [],
      highlightedClipId: null,
    })
  })

  describe('addClip', () => {
    it('adds a clip to the list', () => {
      const clip = makeClip()
      useLibraryStore.getState().addClip(clip)

      expect(useLibraryStore.getState().clips).toHaveLength(1)
      expect(useLibraryStore.getState().clips[0]).toEqual(clip)
    })

    it('prepends new clips (newest first)', () => {
      const clip1 = makeClip({ id: 'clip-1', label: 'Recording 1' })
      const clip2 = makeClip({ id: 'clip-2', label: 'Recording 2' })

      useLibraryStore.getState().addClip(clip1)
      useLibraryStore.getState().addClip(clip2)

      const clips = useLibraryStore.getState().clips
      expect(clips).toHaveLength(2)
      expect(clips[0].id).toBe('clip-2')
      expect(clips[1].id).toBe('clip-1')
    })
  })

  describe('removeClip', () => {
    it('removes a clip by id', () => {
      const clip = makeClip()
      useLibraryStore.getState().addClip(clip)
      useLibraryStore.getState().removeClip('clip-1')

      expect(useLibraryStore.getState().clips).toHaveLength(0)
    })

    it('does nothing if clip id not found', () => {
      const clip = makeClip()
      useLibraryStore.getState().addClip(clip)
      useLibraryStore.getState().removeClip('nonexistent')

      expect(useLibraryStore.getState().clips).toHaveLength(1)
    })
  })

  describe('setHighlightedClip', () => {
    it('sets the highlighted clip id', () => {
      useLibraryStore.getState().setHighlightedClip('clip-1')
      expect(useLibraryStore.getState().highlightedClipId).toBe('clip-1')
    })

    it('clears the highlighted clip id when set to null', () => {
      useLibraryStore.getState().setHighlightedClip('clip-1')
      useLibraryStore.getState().setHighlightedClip(null)
      expect(useLibraryStore.getState().highlightedClipId).toBeNull()
    })
  })
})
