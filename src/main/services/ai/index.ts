import type { IAIProvider } from '@shared/interfaces/ai-provider'
import type { AIBackendConfig } from '@shared/types/ai'
import { ClaudeProvider } from './claude-provider'
import { OpenAIProvider } from './openai-provider'
import { OllamaProvider } from './ollama-provider'

export function createAIProvider(config: AIBackendConfig): IAIProvider {
  switch (config.provider) {
    case 'claude':
      return new ClaudeProvider(config.model, config.cliPath)
    case 'openai':
      return new OpenAIProvider(config.model, config.cliPath)
    case 'ollama':
      return new OllamaProvider(config.model, config.ollamaBaseUrl)
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}

export { ClaudeProvider } from './claude-provider'
export { OpenAIProvider } from './openai-provider'
export { OllamaProvider } from './ollama-provider'
export { buildScriptPrompt, getSystemPrompt } from './prompt-templates'
export { parseScriptText, extractTimingMarkers } from './script-parser'
