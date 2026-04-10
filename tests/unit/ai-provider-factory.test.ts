import { describe, it, expect } from 'vitest'
import { createAIProvider } from '@main/services/ai'
import { ClaudeProvider } from '@main/services/ai/claude-provider'
import { OpenAIProvider } from '@main/services/ai/openai-provider'
import { OllamaProvider } from '@main/services/ai/ollama-provider'

describe('createAIProvider', () => {
  it('creates a ClaudeProvider for "claude" type', () => {
    const provider = createAIProvider({
      provider: 'claude',
      mode: 'cloud',
      apiKey: 'test-key',
    })
    expect(provider).toBeInstanceOf(ClaudeProvider)
    expect(provider.name).toBe('Claude')
  })

  it('creates an OpenAIProvider for "openai" type', () => {
    const provider = createAIProvider({
      provider: 'openai',
      mode: 'cloud',
      apiKey: 'test-key',
    })
    expect(provider).toBeInstanceOf(OpenAIProvider)
    expect(provider.name).toBe('OpenAI')
  })

  it('creates an OllamaProvider for "ollama" type', () => {
    const provider = createAIProvider({
      provider: 'ollama',
      mode: 'local',
      model: 'llama3',
      ollamaBaseUrl: 'http://localhost:11434',
    })
    expect(provider).toBeInstanceOf(OllamaProvider)
    expect(provider.name).toBe('Ollama')
  })

  it('throws for unknown provider', () => {
    expect(() =>
      createAIProvider({
        provider: 'unknown' as 'claude',
        mode: 'cloud',
      }),
    ).toThrow('Unknown AI provider')
  })

  it('ClaudeProvider reports unavailable without API key', () => {
    const provider = createAIProvider({
      provider: 'claude',
      mode: 'cloud',
      apiKey: '',
    })
    expect(provider.isAvailable).toBe(false)
  })

  it('ClaudeProvider reports available with API key', () => {
    const provider = createAIProvider({
      provider: 'claude',
      mode: 'cloud',
      apiKey: 'sk-ant-test',
    })
    expect(provider.isAvailable).toBe(true)
  })

  it('OllamaProvider is always reported as available', () => {
    const provider = createAIProvider({
      provider: 'ollama',
      mode: 'local',
    })
    expect(provider.isAvailable).toBe(true)
  })
})
