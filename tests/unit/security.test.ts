// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// No electron imports needed — security.ts uses only process.env and URL
import { assertTrustedIPCEvent } from '@main/ipc/security'

function makeEvent(url: string | undefined) {
  return {
    senderFrame: url !== undefined ? { url } : undefined,
    sender: { getURL: () => 'http://fallback.invalid' },
  } as Parameters<typeof assertTrustedIPCEvent>[0]
}

function makeEventWithSenderFallback(senderUrl: string) {
  return {
    senderFrame: undefined,
    sender: { getURL: () => senderUrl },
  } as unknown as Parameters<typeof assertTrustedIPCEvent>[0]
}

describe('assertTrustedIPCEvent', () => {
  const originalEnv = process.env.ELECTRON_RENDERER_URL

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ELECTRON_RENDERER_URL
    } else {
      process.env.ELECTRON_RENDERER_URL = originalEnv
    }
  })

  it('passes for a file:// senderFrame URL', () => {
    const event = makeEvent('file:///renderer/index.html')
    expect(() => assertTrustedIPCEvent(event)).not.toThrow()
  })

  it('passes for any file:// URL regardless of path', () => {
    const event = makeEvent('file:///some/other/path.html')
    expect(() => assertTrustedIPCEvent(event)).not.toThrow()
  })

  it('passes when URL matches the dev server origin', () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
    const event = makeEvent('http://localhost:5173/index.html')
    expect(() => assertTrustedIPCEvent(event)).not.toThrow()
  })

  it('throws for a completely untrusted URL', () => {
    delete process.env.ELECTRON_RENDERER_URL
    const event = makeEvent('http://evil.com/xss')
    expect(() => assertTrustedIPCEvent(event)).toThrow('Blocked IPC from untrusted sender')
  })

  it('throws for an empty string URL', () => {
    delete process.env.ELECTRON_RENDERER_URL
    const event = makeEvent('')
    expect(() => assertTrustedIPCEvent(event)).toThrow('Blocked IPC from untrusted sender')
  })

  it('includes the offending URL in the error message', () => {
    delete process.env.ELECTRON_RENDERER_URL
    const badUrl = 'http://attacker.example/payload'
    const event = makeEvent(badUrl)
    expect(() => assertTrustedIPCEvent(event)).toThrow(badUrl)
  })

  it('falls back to sender.getURL when senderFrame is missing', () => {
    const event = makeEventWithSenderFallback('file:///preload.html')
    expect(() => assertTrustedIPCEvent(event)).not.toThrow()
  })

  it('throws when senderFrame is missing and sender.getURL returns untrusted URL', () => {
    delete process.env.ELECTRON_RENDERER_URL
    const event = makeEventWithSenderFallback('http://untrusted.example')
    expect(() => assertTrustedIPCEvent(event)).toThrow('Blocked IPC from untrusted sender')
  })

  it('throws for a URL with a different port than the dev server', () => {
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173'
    const event = makeEvent('http://localhost:9999/index.html')
    expect(() => assertTrustedIPCEvent(event)).toThrow('Blocked IPC from untrusted sender')
  })

  it('throws for an https URL when no ELECTRON_RENDERER_URL is set', () => {
    delete process.env.ELECTRON_RENDERER_URL
    const event = makeEvent('https://localhost:5173/index.html')
    expect(() => assertTrustedIPCEvent(event)).toThrow('Blocked IPC from untrusted sender')
  })
})
