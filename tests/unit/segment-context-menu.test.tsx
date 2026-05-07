// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SegmentContextMenu } from '../../src/renderer/components/timeline/SegmentContextMenu'
import { Segment } from '../../src/renderer/components/timeline/Segment'
import type { Segment as SegmentType } from '@shared/types'
import type { Clip } from '@shared/types/events'
import type { ScriptSection } from '@shared/types/ai'

const mockRemoveSegment = vi.fn()
const mockSetSelectedSegment = vi.fn()
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

const mockSegment: SegmentType = {
  id: 'seg-1',
  trackId: 'track-1',
  startTime: 0,
  endTime: 5000,
  sourceFile: '/tmp/test.mp4',
  sourceOffset: 0,
  label: 'Test Segment',
}

const mockClipScripts: Record<string, ScriptSection[]> = {}

vi.mock('../../src/renderer/stores/timeline-store', () => ({
  useTimelineStore: (selector: (s: {
    removeSegment: typeof mockRemoveSegment
    setSelectedSegment: typeof mockSetSelectedSegment
    selectedSegmentId: string | null
  }) => unknown) =>
    selector({
      removeSegment: mockRemoveSegment,
      setSelectedSegment: mockSetSelectedSegment,
      selectedSegmentId: null,
    }),
}))
vi.mock('../../src/renderer/stores/library-store', () => ({
  useLibraryStore: (selector: (s: { clips: Clip[] }) => unknown) =>
    selector({ clips: [mockClip] }),
}))
vi.mock('../../src/renderer/stores/script-store', () => ({
  useScriptStore: (selector: (s: {
    setSections: typeof mockSetSections
    setClipScript: typeof mockSetClipScript
    clipScripts: Record<string, ScriptSection[]>
  }) => unknown) =>
    selector({ setSections: mockSetSections, setClipScript: mockSetClipScript, clipScripts: mockClipScripts }),
}))
vi.mock('../../src/renderer/stores/ui-store', () => ({
  useUIStore: (selector: (s: {
    setEditorView: typeof mockSetEditorView
    setTimelineCollapsed: typeof mockSetTimelineCollapsed
  }) => unknown) =>
    selector({ setEditorView: mockSetEditorView, setTimelineCollapsed: mockSetTimelineCollapsed }),
}))
vi.mock('../../src/renderer/stores/project-store', () => ({
  useProjectStore: (selector: (s: { activeProjectId: string }) => unknown) =>
    selector({ activeProjectId: mockActiveProjectId }),
}))
vi.mock('../../src/renderer/hooks/usePointerDrag', () => ({
  usePointerDrag: () => ({ onPointerDown: vi.fn() }),
}))
vi.mock('../../src/renderer/components/timeline/timeline-utils', () => ({
  timeToPixel: (time: number) => time / 50,
  pixelToTime: (px: number) => px * 50,
}))
vi.mock('../../src/renderer/components/timeline/ThumbnailStrip', () => ({
  ThumbnailStrip: () => null,
}))

describe('SegmentContextMenu', () => {
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onClose = vi.fn()
    mockRemoveSegment.mockClear()
    mockSetSelectedSegment.mockClear()
    mockSetSections.mockClear()
    mockSetClipScript.mockClear()
    mockSetEditorView.mockClear()
    mockSetTimelineCollapsed.mockClear()
    Object.keys(mockClipScripts).forEach((k) => delete mockClipScripts[k])
    ;(window as Record<string, unknown>).leonardo = undefined
  })

  it('renders both menu items', () => {
    render(<SegmentContextMenu segment={mockSegment} position={{ x: 100, y: 200 }} onClose={onClose} />)

    expect(screen.getByText('Remove from Timeline')).toBeInTheDocument()
    expect(screen.getByText('Generate Script')).toBeInTheDocument()
  })

  it('is positioned at given coordinates', () => {
    render(<SegmentContextMenu segment={mockSegment} position={{ x: 100, y: 200 }} onClose={onClose} />)

    const menu = screen.getByRole('list')
    expect(menu).toHaveStyle({ left: '100px', top: '200px' })
  })

  it('"Remove from Timeline" calls removeSegment with segment id, clears selection, and closes', () => {
    render(<SegmentContextMenu segment={mockSegment} position={{ x: 100, y: 200 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('Remove from Timeline'))

    expect(mockRemoveSegment).toHaveBeenCalledOnce()
    expect(mockRemoveSegment).toHaveBeenCalledWith('seg-1')
    expect(mockSetSelectedSegment).toHaveBeenCalledWith(null)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('"Remove from Timeline" calls setSelectedSegment only with null (stopPropagation prevents segment-id call)', () => {
    render(<SegmentContextMenu segment={mockSegment} position={{ x: 100, y: 200 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('Remove from Timeline'))

    expect(mockSetSelectedSegment).toHaveBeenCalledOnce()
    expect(mockSetSelectedSegment).toHaveBeenCalledWith(null)
  })

  it('"Generate Script" click shows a textarea prompt', () => {
    render(<SegmentContextMenu segment={mockSegment} position={{ x: 100, y: 200 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('Generate Script'))

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('Escape key closes menu', () => {
    render(<SegmentContextMenu segment={mockSegment} position={{ x: 100, y: 200 }} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('handleGenerate success path calls store actions and closes menu', async () => {
    const section: ScriptSection = {
      id: 'sec-1',
      scriptId: 'script-1',
      text: 'Hello world',
      voiceProfileId: null,
      startTime: 0,
      endTime: 5000,
      timingMarkers: [],
      order: 0,
    }
    const mockGenerateScript = vi.fn().mockResolvedValue({ success: true, script: { sections: [section] } })
    ;(window as Record<string, unknown>).leonardo = { ai: { generateScript: mockGenerateScript } }

    render(<SegmentContextMenu segment={mockSegment} position={{ x: 100, y: 200 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('Generate Script'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Write a script' } })
    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      expect(mockSetClipScript).toHaveBeenCalledWith('clip-1', [section])
    })
    expect(mockSetSections).toHaveBeenCalledWith([section])
    expect(mockSetEditorView).toHaveBeenCalledWith('script-only')
    expect(mockSetTimelineCollapsed).toHaveBeenCalledWith(false)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('handleGenerate error path shows error message in DOM', async () => {
    const mockGenerateScript = vi.fn().mockResolvedValue({ success: false, error: 'AI error' })
    ;(window as Record<string, unknown>).leonardo = { ai: { generateScript: mockGenerateScript } }

    render(<SegmentContextMenu segment={mockSegment} position={{ x: 100, y: 200 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('Generate Script'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Write a script' } })
    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => {
      expect(screen.getByText('AI error')).toBeInTheDocument()
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Segment right-click and script overlay', () => {
  beforeEach(() => {
    mockRemoveSegment.mockClear()
    mockSetSelectedSegment.mockClear()
    Object.keys(mockClipScripts).forEach((k) => delete mockClipScripts[k])
  })

  it('right-clicking a segment shows the context menu', () => {
    render(<Segment segment={mockSegment} zoomLevel={1} scrollOffset={0} snapTargets={[]} />)

    const segEl = document.querySelector('[data-segment-id="seg-1"]') as HTMLElement
    fireEvent.contextMenu(segEl, { clientX: 150, clientY: 250 })

    expect(screen.getByText('Remove from Timeline')).toBeInTheDocument()
    expect(screen.getByText('Generate Script')).toBeInTheDocument()
  })

})
