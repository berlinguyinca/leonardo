import { describe, it, expect, vi } from 'vitest'

// Mock fs and child_process so we don't hit the filesystem
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
}))
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

import { extractThumbnails } from '../../src/main/utils/ffmpeg'

describe('extractThumbnails', () => {
  it('returns empty array immediately when durationMs is 0', async () => {
    const result = await extractThumbnails('/tmp/video.mp4', '/tmp/out', 5, 0)
    expect(result).toEqual([])
  })

  it('returns empty array immediately when durationMs is negative', async () => {
    const result = await extractThumbnails('/tmp/video.mp4', '/tmp/out', 5, -100)
    expect(result).toEqual([])
  })
})
