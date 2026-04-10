import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  computeSectionHash,
  getCachedResult,
  setCachedResult,
  clearCache,
  getCacheSize,
} from '@main/services/tts/tts-cache'

// Mock fs.existsSync for cache validity checking
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
  }
})

describe('tts-cache', () => {
  beforeEach(() => {
    clearCache()
  })

  describe('computeSectionHash', () => {
    it('produces consistent hashes for same inputs', () => {
      const hash1 = computeSectionHash('Hello world', 'voice-1', 'piper')
      const hash2 = computeSectionHash('Hello world', 'voice-1', 'piper')
      expect(hash1).toBe(hash2)
    })

    it('produces different hashes for different text', () => {
      const hash1 = computeSectionHash('Hello', 'voice-1', 'piper')
      const hash2 = computeSectionHash('World', 'voice-1', 'piper')
      expect(hash1).not.toBe(hash2)
    })

    it('produces different hashes for different voice', () => {
      const hash1 = computeSectionHash('Hello', 'voice-1', 'piper')
      const hash2 = computeSectionHash('Hello', 'voice-2', 'piper')
      expect(hash1).not.toBe(hash2)
    })

    it('produces different hashes for different engine', () => {
      const hash1 = computeSectionHash('Hello', 'voice-1', 'piper')
      const hash2 = computeSectionHash('Hello', 'voice-1', 'elevenlabs')
      expect(hash1).not.toBe(hash2)
    })

    it('produces a 16-character hex string', () => {
      const hash = computeSectionHash('test', 'v1', 'piper')
      expect(hash).toMatch(/^[a-f0-9]{16}$/)
    })
  })

  describe('cache operations', () => {
    it('returns null for uncached hash', () => {
      expect(getCachedResult('nonexistent')).toBeNull()
    })

    it('stores and retrieves cached result', () => {
      const result = { filePath: '/tmp/audio.wav', duration: 5000, sectionId: 'ss-1' }
      setCachedResult('hash-1', result)
      expect(getCachedResult('hash-1')).toEqual(result)
    })

    it('clearCache removes all entries', () => {
      setCachedResult('a', { filePath: '/a.wav', duration: 1000, sectionId: 'a' })
      setCachedResult('b', { filePath: '/b.wav', duration: 2000, sectionId: 'b' })
      expect(getCacheSize()).toBe(2)

      clearCache()
      expect(getCacheSize()).toBe(0)
      expect(getCachedResult('a')).toBeNull()
    })

    it('getCacheSize returns correct count', () => {
      expect(getCacheSize()).toBe(0)
      setCachedResult('x', { filePath: '/x.wav', duration: 100, sectionId: 'x' })
      expect(getCacheSize()).toBe(1)
      setCachedResult('y', { filePath: '/y.wav', duration: 200, sectionId: 'y' })
      expect(getCacheSize()).toBe(2)
    })
  })
})
