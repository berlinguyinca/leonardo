import { describe, it, expect } from 'vitest'
import type {
  Project,
  Resolution,
  InputModeType,
  ProjectStatus,
  Codec,
  ExportTargetType,
} from '@shared/types/project'
import type { SyncTimeline, SyncPoint, Track, Segment } from '@shared/types/timeline'
import type { Script, ScriptSection, TimingMarker } from '@shared/types/ai'
import type { DOMEvent, Recording } from '@shared/types/events'
import type { VoiceProfile, TTSSynthesisResult } from '@shared/types/tts'
import type { ExportTarget, ExportResult } from '@shared/types/export'
import { RESOLUTION_PRESETS } from '@shared/types/project'
import type { IAIProvider } from '@shared/interfaces/ai-provider'
import type { ITTSProvider } from '@shared/interfaces/tts-provider'
import type { IExportProvider } from '@shared/interfaces/export-provider'
import type { IInputMode } from '@shared/interfaces/input-mode'

describe('shared types - serialization roundtrip', () => {
  it('serializes and deserializes a Project', () => {
    const project: Project = {
      id: 'p-1',
      name: 'Test Project',
      inputMode: 'record-first',
      status: 'draft',
      createdAt: '2026-04-10T00:00:00Z',
      updatedAt: '2026-04-10T00:00:00Z',
      recordingResolution: RESOLUTION_PRESETS['1080p'],
      exportConfig: null,
    }
    const json = JSON.stringify(project)
    const parsed = JSON.parse(json) as Project
    expect(parsed).toEqual(project)
  })

  it('serializes Project with export config', () => {
    const project: Project = {
      id: 'p-2',
      name: 'Export Project',
      inputMode: 'prompt-first',
      status: 'exported',
      createdAt: '2026-04-10T00:00:00Z',
      updatedAt: '2026-04-10T00:00:00Z',
      recordingResolution: RESOLUTION_PRESETS['4K'],
      exportConfig: {
        codec: 'h264',
        resolution: RESOLUTION_PRESETS['1080p'],
        targetType: 'youtube',
        youtubeMetadata: {
          title: 'My Tutorial',
          description: 'A great tutorial',
          tags: ['tutorial', 'ai'],
          privacy: 'public',
          categoryId: '28',
        },
      },
    }
    const roundtrip = JSON.parse(JSON.stringify(project)) as Project
    expect(roundtrip.exportConfig!.youtubeMetadata!.tags).toEqual(['tutorial', 'ai'])
  })

  it('serializes and deserializes DOMEvents', () => {
    const events: DOMEvent[] = [
      {
        id: 'e1',
        type: 'click',
        timestamp: 1000,
        elementSelector: 'button.submit',
        coordinates: { x: 100, y: 200 },
        elementText: 'Submit',
      },
      {
        id: 'e2',
        type: 'navigate',
        timestamp: 2000,
        elementSelector: '',
        coordinates: { x: 0, y: 0 },
        url: 'https://example.com/page2',
      },
    ]
    const roundtrip = JSON.parse(JSON.stringify(events)) as DOMEvent[]
    expect(roundtrip).toHaveLength(2)
    expect(roundtrip[0].type).toBe('click')
    expect(roundtrip[1].url).toBe('https://example.com/page2')
  })

  it('serializes SyncTimeline with sync points and tracks', () => {
    const timeline: SyncTimeline = {
      id: 'tl-1',
      projectId: 'p-1',
      tracks: [
        {
          id: 't1',
          type: 'recording',
          segments: [
            {
              id: 's1',
              trackId: 't1',
              startTime: 0,
              endTime: 5000,
              sourceFile: '/path/to/video.mp4',
              sourceOffset: 0,
              label: 'Intro',
            },
          ],
          zOrder: 0,
          label: 'Video',
          muted: false,
          locked: false,
        },
      ],
      syncPoints: [
        {
          id: 'sp1',
          timelineId: 'tl-1',
          timestamp: 1000,
          type: 'freeze',
          source: 'dom',
          duration: 2000,
          confidence: 0.9,
        },
        {
          id: 'sp2',
          timelineId: 'tl-1',
          timestamp: 3000,
          type: 'zoom',
          source: 'script',
          duration: 1500,
          coordinates: { x: 100, y: 200, width: 300, height: 200 },
          confidence: 0.85,
        },
      ],
      duration: 10000,
      reviewed: false,
    }
    const roundtrip = JSON.parse(JSON.stringify(timeline)) as SyncTimeline
    expect(roundtrip.syncPoints).toHaveLength(2)
    expect(roundtrip.tracks[0].segments[0].label).toBe('Intro')
    expect(roundtrip.syncPoints[1].coordinates!.width).toBe(300)
  })

  it('serializes Script with sections and timing markers', () => {
    const script: Script = {
      id: 'sc-1',
      projectId: 'p-1',
      sections: [
        {
          id: 'ss-1',
          scriptId: 'sc-1',
          text: 'Welcome to this tutorial.',
          voiceProfileId: 'vp-1',
          startTime: 0,
          endTime: 5000,
          timingMarkers: [
            { type: 'pause', position: 2000, duration: 500 },
            { type: 'zoom', position: 3000, selector: '.main-input' },
          ],
          order: 0,
        },
      ],
      aiBackendUsed: 'claude',
      prompt: 'Create a tutorial about form submission',
      generatedAt: '2026-04-10T00:00:00Z',
    }
    const roundtrip = JSON.parse(JSON.stringify(script)) as Script
    expect(roundtrip.sections[0].timingMarkers).toHaveLength(2)
    expect(roundtrip.sections[0].timingMarkers[1].selector).toBe('.main-input')
  })

  it('validates resolution presets', () => {
    expect(RESOLUTION_PRESETS['1080p']).toEqual({ width: 1920, height: 1080, label: '1080p' })
    expect(RESOLUTION_PRESETS['1440p']).toEqual({ width: 2560, height: 1440, label: '1440p' })
    expect(RESOLUTION_PRESETS['4K']).toEqual({ width: 3840, height: 2160, label: '4K' })
  })
})

describe('shared interfaces - type compliance', () => {
  it('IAIProvider interface shape is valid', () => {
    const mock: IAIProvider = {
      name: 'mock-ai',
      isAvailable: true,
      generateScript: async () => ({
        id: 'sc-1',
        projectId: 'p-1',
        sections: [],
        aiBackendUsed: 'claude',
        prompt: '',
        generatedAt: new Date().toISOString(),
      }),
      refineSyncPoints: async () => [],
      testConnection: async () => true,
    }
    expect(mock.generateScript).toBeDefined()
    expect(mock.refineSyncPoints).toBeDefined()
    expect(mock.name).toBe('mock-ai')
  })

  it('ITTSProvider interface shape is valid', () => {
    const mock: ITTSProvider = {
      name: 'mock-tts',
      isAvailable: true,
      synthesize: async () => ({ filePath: '/tmp/audio.wav', duration: 5000, sectionId: 'ss-1' }),
      getVoices: async () => [],
      testConnection: async () => true,
    }
    expect(mock.synthesize).toBeDefined()
    expect(mock.getVoices).toBeDefined()
  })

  it('IInputMode interface shape is valid', () => {
    const mock: IInputMode = {
      type: 'record-first',
      start: async () => {},
      stop: async () => {},
      getRecording: () => ({
        id: 'r-1',
        projectId: 'p-1',
        videoFile: '/path/video.mp4',
        domEvents: [],
        duration: 10000,
        url: 'https://example.com',
        resolution: { width: 1920, height: 1080 },
        createdAt: new Date().toISOString(),
      }),
      getScript: () => null,
      getDOMEvents: () => [],
    }
    expect(mock.type).toBe('record-first')
  })
})
