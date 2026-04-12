// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useLibraryStore } from '@renderer/stores/library-store'
import { useTimelineStore } from '@renderer/stores/timeline-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useProjectStore } from '@renderer/stores/project-store'
import { ClipLibrary } from '@renderer/components/clip-library/ClipLibrary'
import { RecordingControls } from '@renderer/components/browser/RecordingControls'
import { useRecordingStore } from '@renderer/stores/recording-store'
import type { Clip } from '@shared/types/events'

// Isolate ClipLibrary from ClipContextMenu store dependencies
vi.mock('@renderer/components/clip-library/ClipContextMenu', () => ({
  ClipContextMenu: () => null,
}))

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    projectId: 'proj-1',
    filePath: '/recordings/clip-1/recording.webm',
    duration: 5000,
    url: 'https://example.com',
    resolution: { width: 1920, height: 1080 },
    createdAt: '2026-04-10T12:00:00Z',
    label: 'Test Clip',
    ...overrides,
  }
}

function makeWebviewRef(): React.RefObject<Electron.WebviewTag | null> {
  return {
    current: { getWebContentsId: () => 42 } as unknown as Electron.WebviewTag,
  } as React.RefObject<Electron.WebviewTag | null>
}

function setupWindowMock() {
  ;(window as Record<string, unknown>)['leonardo'] = {
    recording: {
      start: vi.fn().mockResolvedValue({ success: true, recordingId: 'rec-1' }),
      stop: vi.fn().mockResolvedValue({
        success: true,
        recordingId: 'rec-1',
        videoPath: '/tmp/recordings/rec-1/rec-1.mp4',
        outputDir: '/tmp/recordings/rec-1',
        duration: 5000,
      }),
      pause: vi.fn().mockResolvedValue({ success: true }),
      resume: vi.fn().mockResolvedValue({ success: true }),
      relayDomEvent: vi.fn(),
      getWebviewPreloadPath: vi.fn().mockResolvedValue('/path/to/webview-preload.js'),
    },
    clip: {
      create: vi.fn().mockImplementation((clip: unknown) => Promise.resolve(clip)),
    },
  }
}

describe('add to timeline — view navigation', () => {
  beforeEach(() => {
    useUIStore.setState({ editorView: 'inline', timelineCollapsed: true })
    useTimelineStore.setState({ addClipToTimeline: vi.fn() } as any)
    useLibraryStore.setState({ clips: [], highlightedClipId: null })
    useProjectStore.setState({ activeProjectId: 'proj-1' } as any)
  })

  describe('ClipLibrary double-click', () => {
    it('switches editorView to inline', () => {
      const clip = makeClip()
      useLibraryStore.setState({ clips: [clip], highlightedClipId: null })

      render(<ClipLibrary />)
      const card = screen.getByText('Test Clip').closest('.clip-card')!
      fireEvent.dblClick(card)

      expect(useUIStore.getState().editorView).toBe('inline')
    })

    it('expands the timeline panel', () => {
      const clip = makeClip()
      useLibraryStore.setState({ clips: [clip], highlightedClipId: null })

      render(<ClipLibrary />)
      const card = screen.getByText('Test Clip').closest('.clip-card')!
      fireEvent.dblClick(card)

      expect(useUIStore.getState().timelineCollapsed).toBe(false)
    })
  })

  describe('RecordingControls "Edit Now"', () => {
    beforeEach(() => {
      setupWindowMock()
      useRecordingStore.setState({
        status: 'idle',
        currentUrl: 'https://example.com',
        recordingDuration: 5000,
        targetResolution: { width: 1920, height: 1080 },
      })
    })

    afterEach(() => {
      vi.clearAllMocks()
      delete (window as Record<string, unknown>)['leonardo']
    })

    async function triggerStop() {
      useRecordingStore.setState({ status: 'idle' })
      render(<RecordingControls webviewRef={makeWebviewRef()} />)
      await act(async () => {
        fireEvent.click(screen.getByText('Record'))
      })
      await act(async () => {
        fireEvent.click(screen.getByText('Stop'))
      })
    }

    it('switches editorView to inline on "Edit Now"', async () => {
      await triggerStop()
      act(() => {
        fireEvent.click(screen.getByText('Edit Now'))
      })
      expect(useUIStore.getState().editorView).toBe('inline')
    })

    it('expands the timeline panel on "Edit Now"', async () => {
      await triggerStop()
      act(() => {
        fireEvent.click(screen.getByText('Edit Now'))
      })
      expect(useUIStore.getState().timelineCollapsed).toBe(false)
    })

    it('switches workspace to editing preset on "Edit Now"', async () => {
      useUIStore.setState({ editorView: 'inline', timelineCollapsed: true, workspacePreset: 'recording' })
      await triggerStop()
      act(() => {
        fireEvent.click(screen.getByText('Edit Now'))
      })
      expect(useUIStore.getState().workspacePreset).toBe('compose')
    })
  })
})
