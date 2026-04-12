import { describe, it, expect } from 'vitest'
import { createAIProvider } from '@main/services/ai'
import { ClaudeProvider } from '@main/services/ai/claude-provider'
import { CodexProvider } from '@main/services/ai/codex-provider'
import { OllamaProvider } from '@main/services/ai/ollama-provider'

describe('createAIProvider', () => {
  it('creates a ClaudeProvider for "claude" type', () => {
    const provider = createAIProvider({ provider: 'claude', mode: 'local' })
    expect(provider).toBeInstanceOf(ClaudeProvider)
    expect(provider.name).toBe('Claude (CLI)')
  })

  it('creates a CodexProvider for "openai" type', () => {
    const provider = createAIProvider({ provider: 'openai', mode: 'local' })
    expect(provider).toBeInstanceOf(CodexProvider)
    expect(provider.name).toBe('codex')
  })

  it('creates a CodexProvider for "codex" type', () => {
    const provider = createAIProvider({ provider: 'codex', mode: 'local' })
    expect(provider).toBeInstanceOf(CodexProvider)
    expect(provider.name).toBe('codex')
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
        mode: 'local',
      }),
    ).toThrow('Unknown AI provider')
  })

  it('creates ClaudeProvider with custom CLI path', () => {
    const provider = createAIProvider({ provider: 'claude', mode: 'local', cliPath: '/usr/local/bin/claude' })
    expect(provider.name).toBe('Claude (CLI)')
  })

  it('creates CodexProvider with custom CLI path', () => {
    const provider = createAIProvider({ provider: 'openai', mode: 'local', cliPath: '/usr/local/bin/codex' })
    expect(provider.name).toBe('codex')
  })

  it('OllamaProvider is always reported as available', () => {
    const provider = createAIProvider({ provider: 'ollama', mode: 'local' })
    expect(provider.isAvailable).toBe(true)
  })
})
