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
  deleteTimeline,
  deleteProject,
} from '@main/services/project-store'

import type { SyncTimeline, Track, Segment, SyncPoint } from '@shared/types'

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

function makeSyncPoint(overrides?: Partial<SyncPoint>): SyncPoint {
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

function makeTimeline(overrides?: Partial<SyncTimeline>): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks: [makeTrack()],
    syncPoints: [makeSyncPoint()],
    duration: 5000,
    reviewed: false,
    ...overrides,
  }
}

describe('timeline persistence (real SQLite)', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'leonardo-timeline-test-'))
    const dbPath = join(tempDir, 'test.db')
    initDatabase(dbPath)
    createProject('p-1', 'Test Project', 'record-first', {
      width: 1920,
      height: 1080,
      label: '1080p',
    })
  })

  afterEach(() => {
    closeDatabase()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('saves and retrieves a timeline with tracks and segments', () => {
    const timeline = makeTimeline()
    saveTimeline(timeline)

    const loaded = getTimeline('p-1')
    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe('tl-1')
    expect(loaded!.projectId).toBe('p-1')
    expect(loaded!.duration).toBe(5000)
    expect(loaded!.reviewed).toBe(false)
    expect(loaded!.tracks).toHaveLength(1)
    expect(loaded!.tracks[0].id).toBe('track-1')
    expect(loaded!.tracks[0].segments).toHaveLength(1)
    expect(loaded!.tracks[0].segments[0].sourceFile).toBe('/path/to/video.mp4')
    expect(loaded!.syncPoints).toHaveLength(1)
    expect(loaded!.syncPoints[0].type).toBe('freeze')
  })

  it('saves timeline with multiple tracks and segments', () => {
    const timeline = makeTimeline({
      tracks: [
        makeTrack({
          id: 'track-1',
          segments: [
            makeSegment({ id: 'seg-1', startTime: 0, endTime: 3000 }),
            makeSegment({ id: 'seg-2', startTime: 3000, endTime: 6000, label: 'Middle' }),
          ],
        }),
        makeTrack({
          id: 'track-2',
          type: 'audio',
          label: 'Audio',
          zOrder: 1,
          segments: [
            makeSegment({ id: 'seg-3', trackId: 'track-2', sourceFile: '/audio.mp3' }),
          ],
        }),
      ],
      duration: 6000,
    })

    saveTimeline(timeline)
    const loaded = getTimeline('p-1')!
    expect(loaded.tracks).toHaveLength(2)
    expect(loaded.tracks[0].segments).toHaveLength(2)
    expect(loaded.tracks[1].type).toBe('audio')
    expect(loaded.tracks[1].segments[0].sourceFile).toBe('/audio.mp3')
  })

  it('overwrites existing timeline on second save (upsert)', () => {
    saveTimeline(makeTimeline())

    // Save again with different data
    const updated = makeTimeline({
      duration: 10000,
      tracks: [
        makeTrack({
          segments: [
            makeSegment({ id: 'seg-new', endTime: 10000, label: 'Updated' }),
          ],
        }),
      ],
      syncPoints: [],
    })
    saveTimeline(updated)

    const loaded = getTimeline('p-1')!
    expect(loaded.duration).toBe(10000)
    expect(loaded.tracks[0].segments[0].id).toBe('seg-new')
    expect(loaded.tracks[0].segments[0].label).toBe('Updated')
    expect(loaded.syncPoints).toHaveLength(0)
  })

  it('returns null for non-existent project', () => {
    expect(getTimeline('nonexistent')).toBeNull()
  })

  it('deletes a timeline', () => {
    saveTimeline(makeTimeline())
    expect(getTimeline('p-1')).not.toBeNull()

    const result = deleteTimeline('p-1')
    expect(result).toBe(true)
    expect(getTimeline('p-1')).toBeNull()
  })

  it('cascade deletes timeline when project is deleted', () => {
    saveTimeline(makeTimeline())
    expect(getTimeline('p-1')).not.toBeNull()

    deleteProject('p-1')
    expect(getTimeline('p-1')).toBeNull()
  })

  it('saves timeline with zero tracks (empty timeline)', () => {
    const timeline = makeTimeline({
      tracks: [],
      syncPoints: [],
      duration: 0,
    })
    saveTimeline(timeline)

    const loaded = getTimeline('p-1')!
    expect(loaded.tracks).toHaveLength(0)
    expect(loaded.syncPoints).toHaveLength(0)
    expect(loaded.duration).toBe(0)
  })

  it('preserves sync point optional fields', () => {
    const timeline = makeTimeline({
      syncPoints: [
        makeSyncPoint({
          type: 'zoom',
          coordinates: { x: 100, y: 200, width: 300, height: 400 },
        }),
        makeSyncPoint({
          id: 'sp-2',
          type: 'annotation',
          annotationText: 'Click here',
        }),
        makeSyncPoint({
          id: 'sp-3',
          type: 'transition',
          transitionType: 'fade',
        }),
      ],
    })
    saveTimeline(timeline)

    const loaded = getTimeline('p-1')!
    expect(loaded.syncPoints).toHaveLength(3)
    expect(loaded.syncPoints[0].coordinates).toEqual({ x: 100, y: 200, width: 300, height: 400 })
    expect(loaded.syncPoints[1].annotationText).toBe('Click here')
    expect(loaded.syncPoints[2].transitionType).toBe('fade')
  })
})
