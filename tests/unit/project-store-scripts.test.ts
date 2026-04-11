import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock electron before importing project-store
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test-userData',
  },
}))

import {
  initDatabase,
  closeDatabase,
  saveScript,
  listScriptsByProject,
  createProject,
  createClip,
} from '@main/services/project-store'
import type { Script } from '@shared/types/ai'
import type { Clip } from '@shared/types/events'

function makeScript(overrides: Partial<Script> = {}): Script {
  return {
    id: 'script-1',
    projectId: 'proj-1',
    aiBackendUsed: 'claude',
    prompt: 'Write a tutorial',
    generatedAt: '2026-04-11T10:00:00Z',
    sections: [
      {
        id: 'sec-1',
        scriptId: 'script-1',
        text: 'Introduction',
        voiceProfileId: null,
        startTime: 0,
        endTime: 5000,
        timingMarkers: [],
        order: 0,
      },
    ],
    ...overrides,
  }
}

describe('project-store: script CRUD', () => {
  beforeEach(() => {
    initDatabase(':memory:')
    // Create a project that scripts can reference
    createProject('proj-1', 'Test Project', 'recording', {
      width: 1920,
      height: 1080,
      label: '1080p',
    })
    // Create a clip that can be linked to scripts
    const clip: Clip = {
      id: 'clip-test',
      projectId: 'proj-1',
      filePath: '/recordings/clip-test/recording.mp4',
      duration: 5000,
      url: '',
      resolution: { width: 1920, height: 1080 },
      createdAt: '2026-04-11T10:00:00Z',
      label: 'Test Clip',
    }
    createClip(clip)
  })

  afterEach(() => {
    closeDatabase()
  })

  describe('saveScript', () => {
    it('saves a script with sections to the DB', () => {
      const script = makeScript()
      const result = saveScript(script)

      expect(result.id).toBe('script-1')
      expect(result.projectId).toBe('proj-1')
      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].text).toBe('Introduction')
    })

    it('persists clipId when provided', () => {
      const script = makeScript()
      const result = saveScript(script, 'clip-test')

      expect(result.clipId).toBe('clip-test')
    })

    it('returns script with clipId from existing field when no clipId arg given', () => {
      const script = makeScript({ clipId: 'clip-test' })
      const result = saveScript(script)

      expect(result.clipId).toBe('clip-test')
    })

    it('round-trips clipId through DB when set on script and no clipId arg given', () => {
      const script = makeScript({ clipId: 'clip-test' })
      saveScript(script)

      const results = listScriptsByProject('proj-1')

      expect(results).toHaveLength(1)
      expect(results[0].clipId).toBe('clip-test')
    })

    it('replaces sections on re-save (upsert behavior)', () => {
      const script = makeScript()
      saveScript(script)

      // Re-save with different sections
      const updatedScript: Script = {
        ...script,
        sections: [
          {
            id: 'sec-new',
            scriptId: 'script-1',
            text: 'New section only',
            voiceProfileId: null,
            startTime: 0,
            endTime: 3000,
            timingMarkers: [],
            order: 0,
          },
        ],
      }
      saveScript(updatedScript)

      const results = listScriptsByProject('proj-1')
      expect(results).toHaveLength(1)
      expect(results[0].sections).toHaveLength(1)
      expect(results[0].sections[0].id).toBe('sec-new')
      expect(results[0].sections[0].text).toBe('New section only')
    })
  })

  describe('listScriptsByProject', () => {
    it('returns scripts with their sections', () => {
      const script = makeScript()
      saveScript(script)

      const results = listScriptsByProject('proj-1')

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('script-1')
      expect(results[0].sections).toHaveLength(1)
      expect(results[0].sections[0].id).toBe('sec-1')
    })

    it('includes clipId when set', () => {
      const script = makeScript()
      saveScript(script, 'clip-test')

      const results = listScriptsByProject('proj-1')

      expect(results[0].clipId).toBe('clip-test')
    })

    it('returns clipId as undefined when not set', () => {
      const script = makeScript()
      saveScript(script)

      const results = listScriptsByProject('proj-1')

      expect(results[0].clipId).toBeUndefined()
    })

    it('returns empty array for unknown project', () => {
      const results = listScriptsByProject('nonexistent-project')

      expect(results).toEqual([])
    })

    it('returns multiple scripts ordered by generated_at descending', () => {
      const script1 = makeScript({
        id: 'script-older',
        generatedAt: '2026-04-10T08:00:00Z',
        sections: [],
      })
      const script2 = makeScript({
        id: 'script-newer',
        generatedAt: '2026-04-11T10:00:00Z',
        sections: [],
      })
      saveScript(script1)
      saveScript(script2)

      const results = listScriptsByProject('proj-1')

      expect(results).toHaveLength(2)
      expect(results[0].id).toBe('script-newer')
      expect(results[1].id).toBe('script-older')
    })
  })
})
