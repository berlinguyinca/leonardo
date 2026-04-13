import type { Project, Resolution } from '@shared/types/project'
import type { SyncTimeline, Track, Segment, SyncPoint } from '@shared/types/timeline'
import type { DOMEvent, Clip, StoryboardStep } from '@shared/types/events'
import type { ScriptSection } from '@shared/types/ai'

export function makeProject(overrides?: Partial<Project>): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    inputMode: 'record-first',
    status: 'draft',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    recordingResolution: { width: 1920, height: 1080, label: '1080p' },
    exportConfig: null,
    ...overrides,
  }
}

export function makeClip(overrides?: Partial<Clip>): Clip {
  return {
    id: 'clip-1',
    projectId: 'proj-1',
    filePath: '/path/to/clip.webm',
    duration: 5000,
    url: 'https://example.com',
    resolution: { width: 1920, height: 1080 },
    createdAt: '2026-01-01T00:00:00Z',
    label: 'Test Clip',
    ...overrides,
  }
}

export function makeSegment(overrides?: Partial<Segment>): Segment {
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

export function makeTrack(overrides?: Partial<Track>): Track {
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

export function makeSyncPoint(overrides?: Partial<SyncPoint>): SyncPoint {
  return {
    id: 'sp-1',
    timelineId: 'tl-1',
    timestamp: 2000,
    type: 'freeze',
    source: 'dom',
    duration: 500,
    confidence: 0.9,
    ...overrides,
  }
}

export function makeTimeline(overrides?: Partial<SyncTimeline>): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'proj-1',
    tracks: [makeTrack()],
    syncPoints: [makeSyncPoint()],
    duration: 5000,
    reviewed: false,
    ...overrides,
  }
}

export function makeStep(overrides?: Partial<StoryboardStep>): StoryboardStep {
  return {
    id: 'step-1',
    type: 'step',
    segmentId: 'seg-1',
    eventIds: [],
    transitionType: 'cut',
    scriptPlaceholder: 'Click the button',
    order: 0,
    ...overrides,
  }
}

export function makeDOMEvent(overrides?: Partial<DOMEvent>): DOMEvent {
  return {
    id: 'evt-1',
    type: 'click',
    timestamp: 1000,
    elementSelector: '#btn',
    coordinates: { x: 100, y: 200 },
    elementText: 'Submit',
    ...overrides,
  }
}

export function makeScriptSection(overrides?: Partial<ScriptSection>): ScriptSection {
  return {
    id: 'sec-1',
    text: 'Click the submit button.',
    order: 0,
    eventIds: ['evt-1'],
    voiceProfileId: 'default',
    ...overrides,
  } as ScriptSection
}

export function makeResolution(overrides?: Partial<Resolution>): Resolution {
  return {
    width: 1920,
    height: 1080,
    label: '1080p',
    ...overrides,
  }
}
