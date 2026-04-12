import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaProvider } from '@main/services/ai/ollama-provider'

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
})
