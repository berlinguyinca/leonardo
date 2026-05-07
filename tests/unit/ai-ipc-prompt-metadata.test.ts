// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { getSystemPrompt, buildScriptPrompt } from '../../src/main/services/ai/prompt-templates'

describe('AI prompt metadata', () => {
  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getSystemPrompt()
    expect(prompt.length).toBeGreaterThan(100)
    expect(prompt).toContain('scriptwriter')
  })

  it('buildScriptPrompt includes all context fields', () => {
    const prompt = buildScriptPrompt({
      domEvents: [],
      recordingDuration: 30000,
      url: 'https://example.com',
      userPrompt: 'Test prompt',
    })
    expect(prompt).toContain('https://example.com')
    expect(prompt).toContain('30.0 seconds')
    expect(prompt).toContain('Test prompt')
  })
})
