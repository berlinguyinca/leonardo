// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'

// ---- stub heavy sub-components to keep smoke tests fast ----
vi.mock('../../src/renderer/components/browser/RecordingBrowser', () => ({
  RecordingBrowser: () => <div data-testid="recording-browser">RecordingBrowser</div>,
}))
vi.mock('../../src/renderer/components/preview/PlaybackPanel', () => ({
  PlaybackPanel: () => <div data-testid="playback-panel">PlaybackPanel</div>,
}))
vi.mock('../../src/renderer/components/properties/PropertiesPanel', () => ({
  PropertiesPanel: () => <div>PropertiesPanel</div>,
}))
vi.mock('../../src/renderer/components/clip-library/ClipLibrary', () => ({
  ClipLibrary: () => <div>ClipLibrary</div>,
}))
vi.mock('../../src/renderer/components/script-editor/ScriptOnlyView', () => ({
  ScriptOnlyView: ({ sections }: { sections: { id: string; text: string }[] }) => (
    <div data-testid="script-only-view">
      {sections.map((s) => (
        <div key={s.id} className="script-section-text">{s.text}</div>
      ))}
    </div>
  ),
}))
vi.mock('../../src/renderer/components/script-editor/InlineEditorView', () => ({
  InlineEditorView: () => <div data-testid="inline-editor">InlineEditorView</div>,
}))
vi.mock('../../src/renderer/components/compose/ComposeView', () => ({
  ComposeView: () => <div data-testid="compose-view">ComposeView</div>,
}))
vi.mock('../../src/renderer/components/script-view/ScriptPresetView', () => ({
  ScriptPresetView: () => <div data-testid="script-preset-view">ScriptPresetView</div>,
}))
vi.mock('../../src/renderer/components/script-editor/ScriptTimelineView', () => ({
  ScriptTimelineView: () => <div data-testid="script-timeline-view">ScriptTimelineView</div>,
}))
vi.mock('../../src/renderer/components/effects/EffectsCanvas', () => ({
  EffectsCanvas: () => <div data-testid="effects-canvas" className="effects-canvas">EffectsCanvas</div>,
}))
vi.mock('../../src/renderer/components/timeline/Timeline', () => ({
  Timeline: () => <div data-testid="timeline">Timeline</div>,
}))
vi.mock('../../src/renderer/components/layout/Toolbar', () => ({
  Toolbar: () => <div data-testid="toolbar">Toolbar</div>,
}))
vi.mock('../../src/renderer/components/project/ProjectHome', () => ({
  ProjectHome: () => <div data-testid="project-home">ProjectHome</div>,
}))
vi.mock('../../src/renderer/hooks/useUndoRedo', () => ({
  useUndoRedo: () => undefined,
}))
vi.mock('../../src/renderer/hooks/usePlayhead', () => ({
  usePlayhead: () => ({ seekTo: vi.fn() }),
}))

// ---- store imports (after mocks) ----
import { useUIStore } from '../../src/renderer/stores/ui-store'
import { useProjectStore } from '../../src/renderer/stores/project-store'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import { useRecordingStore } from '../../src/renderer/stores/recording-store'
import { useScriptStore } from '../../src/renderer/stores/script-store'
import type { SyncTimeline, Track, Segment } from '@shared/types'
import type { ScriptSection } from '@shared/types/ai'

// ---- component imports (after mocks) ----
import { PanelSystem } from '../../src/renderer/components/layout/PanelSystem'
import { Workspace } from '../../src/renderer/components/layout/Workspace'

// ---- helpers ----
function makeSegment(overrides?: Partial<Segment>): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 5000,
    sourceFile: '/path/to/video.mp4',
    sourceOffset: 0,
    label: 'Intro',
    ...overrides,
  }
}

function makeTrack(overrides?: Partial<Track>): Track {
  return {
    id: 'track-1',
    type: 'clip',
    segments: [makeSegment()],
    zOrder: 0,
    label: 'Video',
    muted: false,
    locked: false,
    ...overrides,
  }
}

function makeTimeline(overrides?: Partial<SyncTimeline>): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'proj-1',
    tracks: [makeTrack()],
    syncPoints: [],
    duration: 5000,
    reviewed: false,
    ...overrides,
  }
}

function makeScriptSection(overrides?: Partial<ScriptSection>): ScriptSection {
  return {
    id: 'sec-1',
    scriptId: 'script-1',
    text: 'Hello world narration',
    voiceProfileId: null,
    startTime: 0,
    endTime: 2000,
    timingMarkers: [],
    order: 0,
    ...overrides,
  }
}

// ---- global window.leonardo mock for Workspace effects ----
beforeEach(() => {
  ;(window as Record<string, unknown>).leonardo = {
    timeline: {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
    },
    script: {
      listByProject: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue({}),
    },
    settings: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    },
  }
})

afterEach(() => {
  delete (window as Record<string, unknown>).leonardo
})

// ---- tests ----
describe('smoke-critical-paths', () => {
  it('project loaded → workspace renders timeline container (panel-timeline class present)', async () => {
    useProjectStore.setState({ activeProjectId: 'proj-1', projects: [] })
    useUIStore.setState({ workspacePreset: 'compose', timelineCollapsed: false })
    useTimelineStore.setState({ timeline: makeTimeline() })

    const { container } = render(<Workspace />)

    // Workspace renders PanelSystem which contains a panel-timeline div for compose preset
    expect(container.querySelector('.panel-timeline')).not.toBeNull()
  })

  it('recording store transitions: idle → recording → idle', () => {
    useRecordingStore.setState({ status: 'idle' })
    expect(useRecordingStore.getState().status).toBe('idle')

    act(() => {
      useRecordingStore.getState().setStatus('recording')
    })
    expect(useRecordingStore.getState().status).toBe('recording')

    act(() => {
      useRecordingStore.getState().setStatus('idle')
    })
    expect(useRecordingStore.getState().status).toBe('idle')
  })

  it('script sections render from store data in script-only editor view', () => {
    const sections = [
      makeScriptSection({ id: 'sec-1', text: 'Narration line one' }),
      makeScriptSection({ id: 'sec-2', text: 'Narration line two', order: 1 }),
    ]
    useScriptStore.setState({ sections })
    useUIStore.setState({ workspacePreset: 'compose', editorView: 'script-only', timelineCollapsed: false })

    const { container } = render(<PanelSystem preset="compose" />)

    const sectionTexts = container.querySelectorAll('.script-section-text')
    expect(sectionTexts.length).toBe(2)
    expect(sectionTexts[0].textContent).toBe('Narration line one')
    expect(sectionTexts[1].textContent).toBe('Narration line two')
  })

  it('undo restores previous timeline state via zundo temporal', () => {
    // Set an initial timeline state then mutate it, then undo
    const initialTimeline = makeTimeline({ id: 'tl-initial', duration: 3000 })
    useTimelineStore.setState({ timeline: initialTimeline })

    // Clear past history so we have a clean slate
    useTimelineStore.temporal.getState().clear()

    // Mutate via store action (this records an undo snapshot)
    act(() => {
      useTimelineStore.getState().setTimeline(makeTimeline({ id: 'tl-updated', duration: 9000 }))
    })
    expect(useTimelineStore.getState().timeline?.duration).toBe(9000)

    // Undo should restore the previous value
    act(() => {
      useTimelineStore.temporal.getState().undo()
    })
    expect(useTimelineStore.getState().timeline?.duration).toBe(3000)
  })

  it('view mode switching compose → script → compose preserves compose panel visibility', () => {
    useUIStore.setState({ workspacePreset: 'compose' })
    useProjectStore.setState({ activeProjectId: 'proj-1' })

    const { container, rerender } = render(<PanelSystem preset="compose" />)
    expect(container.querySelector('[data-testid="compose-view"]')).not.toBeNull()

    // Switch to script preset (now uses ScriptTimelineView)
    rerender(<PanelSystem preset="script" />)
    expect(container.querySelector('[data-testid="script-timeline-view"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="compose-view"]')).toBeNull()

    // Switch back to compose
    rerender(<PanelSystem preset="compose" />)
    expect(container.querySelector('[data-testid="compose-view"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="script-timeline-view"]')).toBeNull()
  })

  it('effects canvas renders overlay element in effects preset', () => {
    useUIStore.setState({ workspacePreset: 'effects', timelineCollapsed: false })
    useTimelineStore.setState({ timeline: makeTimeline(), playheadPosition: 1000 })

    const { container } = render(<PanelSystem preset="effects" />)

    // EffectsCanvas stub renders with class effects-canvas
    expect(container.querySelector('[data-testid="effects-canvas"]')).not.toBeNull()
    // Effects preset always has a timeline panel
    expect(container.querySelector('.panel-timeline')).not.toBeNull()
  })
})
