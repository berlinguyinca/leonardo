import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaProvider } from '@main/services/ai/ollama-provider'
import type { Script } from '@shared/types/ai'

describe('OllamaProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('includes the user prompt when generating scripts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: 'Section 1\nHello world',
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OllamaProvider('llama3', 'http://localhost:11434')
    await provider.generateScript('Explain the login flow', {
      domEvents: [],
      recordingDuration: 30_000,
      url: 'https://example.com',
      userPrompt: 'Explain the login flow',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        body: expect.stringContaining('Explain the login flow'),
      }),
    )
  })

  describe('refineSyncPoints', () => {
    const makeScript = (): Script => ({
      id: 'script-1',
      projectId: 'proj-1',
      sections: [{
        id: 's1',
        scriptId: 'script-1',
        order: 0,
        text: 'Step one',
        voiceProfileId: null,
        startTime: 0,
        endTime: 5000,
        timingMarkers: [],
      }],
      aiBackendUsed: 'ollama',
      prompt: 'test',
      generatedAt: new Date().toISOString(),
    })

    it('maps raw JSON response to validated SyncPoint objects', async () => {
      const rawPoints = [
        { timestamp: 1500, type: 'freeze', duration: 2000, confidence: 0.9 },
        { timestamp: 3000, type: 'zoom', duration: 1000, confidence: 0.7 },
      ]
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: { content: `Here are sync points:\n${JSON.stringify(rawPoints)}` },
        }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider('llama3', 'http://localhost:11434')
      const result = await provider.refineSyncPoints(makeScript(), [])

      expect(result).toHaveLength(2)

      const [first, second] = result
      // Required fields must be present
      expect(first.id).toBeTruthy()
      expect(first.timelineId).toBe('')
      expect(first.source).toBe('script')
      expect(first.timestamp).toBe(1500)
      expect(first.type).toBe('freeze')
      expect(first.duration).toBe(2000)
      expect(first.confidence).toBe(0.9)

      expect(second.type).toBe('zoom')
      expect(second.timestamp).toBe(3000)
    })

    it('falls back to annotation for unknown type values', async () => {
      const rawPoints = [{ timestamp: 500, type: 'unknown-type', duration: 0, confidence: 0.5 }]
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify(rawPoints) },
        }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider('llama3', 'http://localhost:11434')
      const result = await provider.refineSyncPoints(makeScript(), [])

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('annotation')
    })

    it('returns empty array and logs error when JSON parsing fails', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: { content: 'This is not JSON at all' },
        }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const provider = new OllamaProvider('llama3', 'http://localhost:11434')
      const result = await provider.refineSyncPoints(makeScript(), [])

      expect(result).toEqual([])
      // Error should not have been called since no JSON parse exception — just no match
      errorSpy.mockRestore()
    })

    it('logs error and returns empty array when fetch throws', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))
      vi.stubGlobal('fetch', fetchMock)

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const provider = new OllamaProvider('llama3', 'http://localhost:11434')
      const result = await provider.refineSyncPoints(makeScript(), [])

      expect(result).toEqual([])
      errorSpy.mockRestore()
    })

    it('assigns unique ids to each sync point', async () => {
      const rawPoints = [
        { timestamp: 100, type: 'annotation', duration: 500, confidence: 0.8 },
        { timestamp: 200, type: 'annotation', duration: 500, confidence: 0.8 },
      ]
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify(rawPoints) },
        }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider('llama3', 'http://localhost:11434')
      const result = await provider.refineSyncPoints(makeScript(), [])

      expect(result[0].id).not.toBe(result[1].id)
    })

    it('defaults missing numeric fields to safe values', async () => {
      const rawPoints = [{ type: 'transition' }]
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: { content: JSON.stringify(rawPoints) },
        }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const provider = new OllamaProvider('llama3', 'http://localhost:11434')
      const result = await provider.refineSyncPoints(makeScript(), [])

      expect(result[0].timestamp).toBe(0)
      expect(result[0].duration).toBe(0)
      expect(result[0].confidence).toBe(0.5)
    })
  })
})
