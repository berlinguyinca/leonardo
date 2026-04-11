// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClipContextMenu } from '../../src/renderer/components/clip-library/ClipContextMenu'
import type { Clip } from '@shared/types/events'

const mockAddClipToTimeline = vi.fn()
const mockRemoveClip = vi.fn()
const mockSetSections = vi.fn()
const mockSetEditorView = vi.fn()
const mockSetTimelineCollapsed = vi.fn()
const mockActiveProjectId = 'proj-1'

vi.mock('../../src/renderer/stores/timeline-store', () => ({
  useTimelineStore: (selector: (s: { addClipToTimeline: typeof mockAddClipToTimeline }) => unknown) =>
    selector({ addClipToTimeline: mockAddClipToTimeline }),
}))
vi.mock('../../src/renderer/stores/library-store', () => ({
  useLibraryStore: (selector: (s: { removeClip: typeof mockRemoveClip }) => unknown) =>
    selector({ removeClip: mockRemoveClip }),
}))
vi.mock('../../src/renderer/stores/script-store', () => ({
  useScriptStore: (selector: (s: { setSections: typeof mockSetSections }) => unknown) =>
    selector({ setSections: mockSetSections }),
}))
vi.mock('../../src/renderer/stores/ui-store', () => ({
  useUIStore: (selector: (s: { setEditorView: typeof mockSetEditorView; setTimelineCollapsed: typeof mockSetTimelineCollapsed }) => unknown) =>
    selector({ setEditorView: mockSetEditorView, setTimelineCollapsed: mockSetTimelineCollapsed }),
}))
vi.mock('../../src/renderer/stores/project-store', () => ({
  useProjectStore: (selector: (s: { activeProjectId: string }) => unknown) =>
    selector({ activeProjectId: mockActiveProjectId }),
}))

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

describe('ClipContextMenu', () => {
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onClose = vi.fn()
    mockAddClipToTimeline.mockClear()
    mockRemoveClip.mockClear()
    mockSetSections.mockClear()
    mockSetEditorView.mockClear()
    mockSetTimelineCollapsed.mockClear()
  })

  it('renders all 4 menu items', () => {
    render(<ClipContextMenu clip={mockClip} position={{ x: 100, y: 200 }} onClose={onClose} />)

    expect(screen.getByText('Add to Timeline')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.getByText('Generate Script')).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('is positioned at given coordinates', () => {
    render(<ClipContextMenu clip={mockClip} position={{ x: 100, y: 200 }} onClose={onClose} />)

    const menu = screen.getByRole('list')
    expect(menu).toHaveStyle({ left: '100px', top: '200px' })
  })

  it('"Add to Timeline" click calls addClipToTimeline, switches view to inline, and closes', () => {
    render(<ClipContextMenu clip={mockClip} position={{ x: 100, y: 200 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('Add to Timeline'))

    expect(mockAddClipToTimeline).toHaveBeenCalledOnce()
    expect(mockAddClipToTimeline).toHaveBeenCalledWith(mockClip)
    expect(mockSetEditorView).toHaveBeenCalledWith('inline')
    expect(mockSetTimelineCollapsed).toHaveBeenCalledWith(false)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('"Delete" click calls removeClip and onClose', () => {
    render(<ClipContextMenu clip={mockClip} position={{ x: 100, y: 200 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('Delete'))

    expect(mockRemoveClip).toHaveBeenCalledOnce()
    expect(mockRemoveClip).toHaveBeenCalledWith(mockClip.id)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('"Generate Script" click shows a textarea prompt', () => {
    render(<ClipContextMenu clip={mockClip} position={{ x: 100, y: 200 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('Generate Script'))

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('"Export" click calls onClose', () => {
    render(<ClipContextMenu clip={mockClip} position={{ x: 100, y: 200 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('Export'))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Escape key closes menu', () => {
    render(<ClipContextMenu clip={mockClip} position={{ x: 100, y: 200 }} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
  })
})
