// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Segment } from '@shared/types'
import type { Clip } from '@shared/types/events'

const mockSetSections = vi.fn()
const mockSetClipScript = vi.fn()
const mockSetEditorView = vi.fn()
const mockSetTimelineCollapsed = vi.fn()
const mockActiveProjectId = 'proj-1'

const mockClip: Clip = {
  id: 'clip-1',
  projectId: 'proj-1',
  filePath: '/tmp/test.mp4',
  duration: 5000,
  url: 'https://example.com',
  resolution: { width: 1920, height: 1080 },
  createdAt: new Date().toISOString(),
  label: 'Test Clip',
}

vi.mock('../../src/renderer/stores/library-store', () => ({
  useLibraryStore: (selector: (s: { clips: Clip[] }) => unknown) =>
    selector({ clips: [mockClip] }),
}))
vi.mock('../../src/renderer/stores/script-store', () => ({
  useScriptStore: (selector: (s: { setSections: typeof mockSetSections; setClipScript: typeof mockSetClipScript }) => unknown) =>
    selector({ setSections: mockSetSections, setClipScript: mockSetClipScript }),
}))
vi.mock('../../src/renderer/stores/ui-store', () => ({
  useUIStore: (selector: (s: { setEditorView: typeof mockSetEditorView; setTimelineCollapsed: typeof mockSetTimelineCollapsed }) => unknown) =>
    selector({ setEditorView: mockSetEditorView, setTimelineCollapsed: mockSetTimelineCollapsed }),
}))
vi.mock('../../src/renderer/stores/project-store', () => ({
  useProjectStore: (selector: (s: { activeProjectId: string }) => unknown) =>
    selector({ activeProjectId: mockActiveProjectId }),
}))
vi.mock('../../src/renderer/components/properties/InteractionsPanel', () => ({
  InteractionsPanel: () => null,
}))

import { SegmentProperties } from '../../src/renderer/components/properties/SegmentProperties'

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 5000,
    sourceFile: '/tmp/test.mp4',
    sourceOffset: 0,
    label: 'Seg 1',
    ...overrides,
  }
}

describe('SegmentProperties: Generate Script button', () => {
  beforeEach(() => {
    mockSetSections.mockClear()
    mockSetClipScript.mockClear()
    mockSetEditorView.mockClear()
    mockSetTimelineCollapsed.mockClear()
    // Set up window.leonardo
    ;(window as Record<string, unknown>).leonardo = {
      ai: {
        generateScript: vi.fn(),
      },
    }
  })

  it('shows "Generate Script" button when clip is matched', () => {
    render(<SegmentProperties segment={makeSegment()} />)
    expect(screen.getByText('Generate Script')).toBeInTheDocument()
  })

  it('does not show "Generate Script" button when no clip matches', () => {
    render(<SegmentProperties segment={makeSegment({ sourceFile: '/nonexistent.mp4' })} />)
    expect(screen.queryByText('Generate Script')).not.toBeInTheDocument()
  })

  it('clicking "Generate Script" shows a textarea prompt', () => {
    render(<SegmentProperties segment={makeSegment()} />)
    fireEvent.click(screen.getByText('Generate Script'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Describe what to generate...')).toBeInTheDocument()
  })

  it('clicking Cancel hides the textarea prompt', () => {
    render(<SegmentProperties segment={makeSegment()} />)
    fireEvent.click(screen.getByText('Generate Script'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Generate Script')).toBeInTheDocument()
  })

  it('success path calls setSections, setClipScript, setEditorView, setTimelineCollapsed', async () => {
    const mockSections = [{ id: 's1', title: 'Intro', content: 'Hello', order: 0 }]
    const generateScript = vi.fn().mockResolvedValue({
      success: true,
      script: { sections: mockSections },
    })
    ;(window as Record<string, unknown>).leonardo = { ai: { generateScript } }

    render(<SegmentProperties segment={makeSegment()} />)
    fireEvent.click(screen.getByText('Generate Script'))

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Make a tutorial script' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    await waitFor(() => {
      expect(generateScript).toHaveBeenCalledWith({
        config: { provider: 'claude', mode: 'cloud' },
        prompt: 'Make a tutorial script',
        context: {
          domEvents: [],
          recordingDuration: mockClip.duration,
          url: mockClip.url,
          userPrompt: 'Make a tutorial script',
        },
        projectId: mockActiveProjectId,
        clipId: mockClip.id,
      })
      expect(mockSetClipScript).toHaveBeenCalledWith(mockClip.id, mockSections)
      expect(mockSetSections).toHaveBeenCalledWith(mockSections)
      expect(mockSetEditorView).toHaveBeenCalledWith('script-only')
      expect(mockSetTimelineCollapsed).toHaveBeenCalledWith(false)
    })

    // Prompt should be hidden after success
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('error path shows error message', async () => {
    const generateScript = vi.fn().mockResolvedValue({
      success: false,
      error: 'AI unavailable',
    })
    ;(window as Record<string, unknown>).leonardo = { ai: { generateScript } }

    render(<SegmentProperties segment={makeSegment()} />)
    fireEvent.click(screen.getByText('Generate Script'))

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Some prompt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    await waitFor(() => {
      expect(screen.getByText('AI unavailable')).toBeInTheDocument()
    })

    expect(mockSetSections).not.toHaveBeenCalled()
  })

  it('exception path shows error message', async () => {
    const generateScript = vi.fn().mockRejectedValue(new Error('Network error'))
    ;(window as Record<string, unknown>).leonardo = { ai: { generateScript } }

    render(<SegmentProperties segment={makeSegment()} />)
    fireEvent.click(screen.getByText('Generate Script'))

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Some prompt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    expect(mockSetSections).not.toHaveBeenCalled()
  })

  it('Generate button is disabled when prompt is empty', () => {
    render(<SegmentProperties segment={makeSegment()} />)
    fireEvent.click(screen.getByText('Generate Script'))
    const generateBtn = screen.getByRole('button', { name: 'Generate' })
    expect(generateBtn).toBeDisabled()
  })

  it('Generate button is enabled when prompt has text', () => {
    render(<SegmentProperties segment={makeSegment()} />)
    fireEvent.click(screen.getByText('Generate Script'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    const generateBtn = screen.getByRole('button', { name: 'Generate' })
    expect(generateBtn).not.toBeDisabled()
  })
})
