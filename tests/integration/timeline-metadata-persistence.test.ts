// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test-electron',
  },
}))

import {
  initDatabase,
  closeDatabase,
  createProject,
  saveTimeline,
  getTimeline,
} from '@main/services/project-store'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import type { SyncTimeline, Track, Segment } from '@shared/types'
import type { ScriptSection } from '@shared/types/ai'

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 10000,
    sourceFile: '/path/to/video.mp4',
    sourceOffset: 0,
    label: 'Test Segment',
    ...overrides,
  }
}

function makeTrack(overrides: Partial<Track> = {}): Track {
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

function makeTimeline(overrides: Partial<SyncTimeline> = {}): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-test',
    tracks: [makeTrack()],
    syncPoints: [],
    duration: 10000,
    reviewed: false,
    ...overrides,
  }
}

function makeScriptSection(overrides: Partial<ScriptSection> = {}): ScriptSection {
  return {
    id: 'sec-1',
    text: 'Hello world test section.',
    order: 0,
    eventIds: [],
    voiceProfileId: 'default',
    ...overrides,
  } as ScriptSection
}

describe('timeline metadata persistence (real SQLite)', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'leonardo-metadata-test-'))
    const dbPath = join(tempDir, 'test.db')
    initDatabase(dbPath)
    createProject('p-test', 'Test Project', 'record-first', {
      width: 1920,
      height: 1080,
      label: '1080p',
    })
    // Reset store
    useTimelineStore.setState({ timeline: null })
  })

  afterEach(() => {
    closeDatabase()
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('metadata column persistence', () => {
    it('saves segment with metadata and reloads it correctly', () => {
      const metadata = JSON.stringify({ sectionId: 'sec-abc', sectionOrder: 2 })
      const segWithMeta = makeSegment({ id: 'seg-meta', metadata })
      const timeline = makeTimeline({
        tracks: [makeTrack({ segments: [segWithMeta] })],
      })

      saveTimeline(timeline)

      const loaded = getTimeline('p-test')
      expect(loaded).not.toBeNull()

      const seg = loaded!.tracks[0].segments.find((s) => s.id === 'seg-meta')
      expect(seg).toBeDefined()
      expect(seg!.metadata).toBe(metadata)

      const parsed = JSON.parse(seg!.metadata!)
      expect(parsed.sectionId).toBe('sec-abc')
      expect(parsed.sectionOrder).toBe(2)
    })

    it('saves segment without metadata and reloads it as undefined', () => {
      const segNoMeta = makeSegment({ id: 'seg-no-meta' })
      // Explicitly no metadata field
      delete (segNoMeta as Partial<Segment>).metadata

      const timeline = makeTimeline({
        tracks: [makeTrack({ segments: [segNoMeta] })],
      })

      saveTimeline(timeline)

      const loaded = getTimeline('p-test')
      expect(loaded).not.toBeNull()

      const seg = loaded!.tracks[0].segments.find((s) => s.id === 'seg-no-meta')
      expect(seg).toBeDefined()
      expect(seg!.metadata).toBeUndefined()
    })

    it('saves segment with null metadata and reloads it as undefined', () => {
      const segNullMeta: Segment = {
        ...makeSegment({ id: 'seg-null-meta' }),
        metadata: undefined,
      }

      const timeline = makeTimeline({
        tracks: [makeTrack({ segments: [segNullMeta] })],
      })

      saveTimeline(timeline)

      const loaded = getTimeline('p-test')
      expect(loaded).not.toBeNull()

      const seg = loaded!.tracks[0].segments.find((s) => s.id === 'seg-null-meta')
      expect(seg).toBeDefined()
      expect(seg!.metadata).toBeUndefined()
    })

    it('preserves metadata across multiple save/reload cycles', () => {
      const metadata = JSON.stringify({ sectionId: 'sec-x', sectionOrder: 1 })
      const seg = makeSegment({ id: 'seg-persist', metadata })
      const timeline = makeTimeline({ tracks: [makeTrack({ segments: [seg] })] })

      // Save twice (simulating multiple auto-saves)
      saveTimeline(timeline)
      saveTimeline(timeline)

      const loaded = getTimeline('p-test')
      const loadedSeg = loaded!.tracks[0].segments.find((s) => s.id === 'seg-persist')
      expect(loadedSeg!.metadata).toBe(metadata)
    })

    it('saves multiple segments with different metadata values', () => {
      const metaA = JSON.stringify({ sectionId: 'sec-a', sectionOrder: 0 })
      const metaB = JSON.stringify({ sectionId: 'sec-b', sectionOrder: 1 })

      const segA = makeSegment({ id: 'seg-a', startTime: 0, endTime: 5000, metadata: metaA })
      const segB = makeSegment({ id: 'seg-b', startTime: 5000, endTime: 10000, metadata: metaB })

      const timeline = makeTimeline({
        tracks: [makeTrack({ segments: [segA, segB] })],
      })

      saveTimeline(timeline)

      const loaded = getTimeline('p-test')
      expect(loaded).not.toBeNull()

      const loadedA = loaded!.tracks[0].segments.find((s) => s.id === 'seg-a')
      const loadedB = loaded!.tracks[0].segments.find((s) => s.id === 'seg-b')

      expect(JSON.parse(loadedA!.metadata!).sectionId).toBe('sec-a')
      expect(JSON.parse(loadedB!.metadata!).sectionId).toBe('sec-b')
    })
  })

  describe('splitClipBySections → save → reload', () => {
    it('persists all segments with metadata after splitClipBySections', () => {
      const timeline = makeTimeline()
      useTimelineStore.setState({ timeline })

      const sections: ScriptSection[] = [
        makeScriptSection({ id: 'section-1', text: 'One two three four five', order: 0 }),
        makeScriptSection({ id: 'section-2', text: 'Six seven eight nine ten', order: 1 }),
      ]

      useTimelineStore.getState().splitClipBySections('seg-1', sections)

      const splitTimeline = useTimelineStore.getState().timeline!
      saveTimeline(splitTimeline)

      const loaded = getTimeline('p-test')
      expect(loaded).not.toBeNull()

      const segments = loaded!.tracks[0].segments
      expect(segments).toHaveLength(2)

      // Both segments should have metadata
      for (const seg of segments) {
        expect(seg.metadata).toBeDefined()
        const meta = JSON.parse(seg.metadata!)
        expect(meta.sectionId).toBeDefined()
        expect(meta.sectionOrder).toBeDefined()
      }

      const seg0 = segments.find((s) => JSON.parse(s.metadata!).sectionId === 'section-1')
      const seg1 = segments.find((s) => JSON.parse(s.metadata!).sectionId === 'section-2')

      expect(seg0).toBeDefined()
      expect(JSON.parse(seg0!.metadata!).sectionOrder).toBe(0)
      expect(seg1).toBeDefined()
      expect(JSON.parse(seg1!.metadata!).sectionOrder).toBe(1)
    })

    it('segments split from same source preserve sourceFile after reload', () => {
      const sourceFile = '/recordings/my-capture.webm'
      const seg = makeSegment({ id: 'seg-1', sourceFile })
      const timeline = makeTimeline({ tracks: [makeTrack({ segments: [seg] })] })
      useTimelineStore.setState({ timeline })

      const sections: ScriptSection[] = [
        makeScriptSection({ id: 'part-a', text: 'Hello world foo bar', order: 0 }),
        makeScriptSection({ id: 'part-b', text: 'Baz qux quux', order: 1 }),
      ]

      useTimelineStore.getState().splitClipBySections('seg-1', sections)

      const splitTimeline = useTimelineStore.getState().timeline!
      saveTimeline(splitTimeline)

      const loaded = getTimeline('p-test')
      const segments = loaded!.tracks[0].segments

      for (const s of segments) {
        expect(s.sourceFile).toBe(sourceFile)
      }
    })
  })
})
