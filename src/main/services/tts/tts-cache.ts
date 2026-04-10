import { createHash } from 'crypto'
import { existsSync } from 'fs'
import type { TTSSynthesisResult } from '@shared/types/tts'

/**
 * Cache key = hash(text + voiceId + engine).
 * If a cached WAV/MP3 file exists at the expected path, skip re-synthesis.
 */

const cache = new Map<string, TTSSynthesisResult>()

export function computeSectionHash(text: string, voiceId: string, engine: string): string {
  return createHash('sha256')
    .update(`${engine}:${voiceId}:${text}`)
    .digest('hex')
    .slice(0, 16)
}

export function getCachedResult(hash: string): TTSSynthesisResult | null {
  const result = cache.get(hash)
  if (result && existsSync(result.filePath)) {
    return result
  }
  // File was deleted — remove stale cache entry
  if (result) cache.delete(hash)
  return null
}

export function setCachedResult(hash: string, result: TTSSynthesisResult): void {
  cache.set(hash, result)
}

export function clearCache(): void {
  cache.clear()
}

export function getCacheSize(): number {
  return cache.size
}
