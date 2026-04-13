import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

import { PiperProvider } from '@main/services/tts/piper-provider'
import type { VoiceProfile } from '@shared/types/tts'
import { EventEmitter } from 'events'
import { existsSync, readdirSync } from 'fs'
import { spawn } from 'child_process'

const mockExistsSync = vi.mocked(existsSync)
const mockReaddirSync = vi.mocked(readdirSync)
const mockSpawn = vi.mocked(spawn)

// The provider uses require('fs').readdirSync inside getVoices.
// Patch the Node module cache so require('fs') also returns mocked functions.
const nodeFs = require('fs') as typeof import('fs')
nodeFs.readdirSync = mockReaddirSync as any
nodeFs.existsSync = mockExistsSync as any

function makeVoice(voiceId = '/models/en-us.onnx'): VoiceProfile {
  return { id: 'en-us', name: 'en us', provider: 'piper', voiceId, samples: [], isDefault: false }
}

function makeProc(opts: { exitCode?: number; error?: Error } = {}) {
  const stdin = { write: vi.fn(), end: vi.fn() }
  const stderr = new EventEmitter()
  const proc = new EventEmitter() as NodeJS.EventEmitter & {
    stdin: typeof stdin
    stderr: typeof stderr
  }
  ;(proc as any).stdin = stdin
  ;(proc as any).stderr = stderr

  if (opts.error) {
    setTimeout(() => proc.emit('error', opts.error), 0)
  } else {
    const code = opts.exitCode ?? 0
    setTimeout(() => proc.emit('close', code), 0)
  }

  return proc
}

describe('PiperProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isAvailable returns true when piper binary exists', () => {
    mockExistsSync.mockReturnValue(true)
    const provider = new PiperProvider('/usr/bin/piper', '/models')
    expect(provider.isAvailable).toBe(true)
    expect(mockExistsSync).toHaveBeenCalledWith('/usr/bin/piper')
  })

  it('isAvailable returns false when binary does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    const provider = new PiperProvider('/usr/bin/piper', '/models')
    expect(provider.isAvailable).toBe(false)
  })

  it('synthesize spawns piper with correct args and resolves on success', async () => {
    // existsSync for output file check after close returns true
    mockExistsSync.mockReturnValue(true)
    const proc = makeProc({ exitCode: 0 })
    mockSpawn.mockReturnValue(proc as any)

    const provider = new PiperProvider('/usr/bin/piper', '/models')
    const voice = makeVoice('/models/en-us.onnx')
    const result = await provider.synthesize('Hello world', voice)

    expect(mockSpawn).toHaveBeenCalledWith(
      '/usr/bin/piper',
      ['--model', '/models/en-us.onnx', '--output_file', expect.stringContaining('.wav')],
      expect.any(Object),
    )
    expect(result.filePath).toContain('.wav')
    expect(result.duration).toBeGreaterThan(0)
  })

  it('synthesize rejects on non-zero exit code', async () => {
    // existsSync for output file returns false -> triggers reject path
    mockExistsSync.mockReturnValue(false)
    const proc = makeProc({ exitCode: 1 })
    mockSpawn.mockReturnValue(proc as any)

    const provider = new PiperProvider('/usr/bin/piper', '/models')
    await expect(provider.synthesize('Hello', makeVoice())).rejects.toThrow('Piper TTS failed')
  })

  it('synthesize rejects on process error event', async () => {
    const proc = makeProc({ error: new Error('spawn ENOENT') })
    mockSpawn.mockReturnValue(proc as any)

    const provider = new PiperProvider('/usr/bin/piper', '/models')
    await expect(provider.synthesize('Hello', makeVoice())).rejects.toThrow('Piper TTS process error')
  })

  it('getVoices lists .onnx files from models directory', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['en-us.onnx', 'de-de.onnx', 'readme.txt'] as any)

    const provider = new PiperProvider('/usr/bin/piper', '/models')
    const voices = await provider.getVoices()

    expect(voices).toHaveLength(2)
    expect(voices[0].provider).toBe('piper')
    expect(voices.map((v) => v.name)).toEqual(expect.arrayContaining(['en us', 'de de']))
  })

  it('getVoices returns empty array when models dir does not exist', async () => {
    mockExistsSync.mockReturnValue(false)
    const provider = new PiperProvider('/usr/bin/piper', '/nonexistent')
    const voices = await provider.getVoices()
    expect(voices).toEqual([])
  })

  it('getVoices returns empty array when modelsDir is empty string', async () => {
    const provider = new PiperProvider('/usr/bin/piper', '')
    const voices = await provider.getVoices()
    expect(voices).toEqual([])
  })
})
