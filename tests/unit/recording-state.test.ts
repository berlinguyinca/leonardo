// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'

// Pure module state — no mocks needed
import {
  getRecordingWebviewId,
  setRecordingWebviewId,
} from '@main/services/recording-state'

describe('recording-state module', () => {
  beforeEach(() => {
    // Reset state to null before each test
    setRecordingWebviewId(null)
  })

  it('getRecordingWebviewId returns null by default', () => {
    expect(getRecordingWebviewId()).toBeNull()
  })

  it('setRecordingWebviewId stores a number and getRecordingWebviewId returns it', () => {
    setRecordingWebviewId(42)
    expect(getRecordingWebviewId()).toBe(42)
  })

  it('can clear the stored id by setting null', () => {
    setRecordingWebviewId(7)
    setRecordingWebviewId(null)
    expect(getRecordingWebviewId()).toBeNull()
  })

  it('round-trip with a different number', () => {
    setRecordingWebviewId(999)
    expect(getRecordingWebviewId()).toBe(999)
    setRecordingWebviewId(1)
    expect(getRecordingWebviewId()).toBe(1)
  })
})
