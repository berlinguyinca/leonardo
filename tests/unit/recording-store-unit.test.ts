// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { useRecordingStore } from '@renderer/stores/recording-store'
import { RESOLUTION_PRESETS } from '@shared/types'

describe('recording-store (Zustand)', () => {
  beforeEach(() => {
    // Reset to initial state
    useRecordingStore.setState({
      status: 'idle',
      currentUrl: '',
      recordingDuration: 0,
      targetResolution: RESOLUTION_PRESETS['1080p'],
    })
  })

  it('initial status is idle', () => {
    expect(useRecordingStore.getState().status).toBe('idle')
  })

  it('setStatus updates status', () => {
    useRecordingStore.getState().setStatus('recording')
    expect(useRecordingStore.getState().status).toBe('recording')
  })

  it('setCurrentUrl updates currentUrl', () => {
    useRecordingStore.getState().setCurrentUrl('https://example.com')
    expect(useRecordingStore.getState().currentUrl).toBe('https://example.com')
  })

  it('setRecordingDuration updates recordingDuration', () => {
    useRecordingStore.getState().setRecordingDuration(12345)
    expect(useRecordingStore.getState().recordingDuration).toBe(12345)
  })

  it('setTargetResolution updates targetResolution', () => {
    const r4k = RESOLUTION_PRESETS['4K']
    useRecordingStore.getState().setTargetResolution(r4k)
    expect(useRecordingStore.getState().targetResolution).toEqual(r4k)
  })

  it('default resolution is 1080p', () => {
    const state = useRecordingStore.getState()
    expect(state.targetResolution).toEqual(RESOLUTION_PRESETS['1080p'])
    expect(state.targetResolution.width).toBe(1920)
    expect(state.targetResolution.height).toBe(1080)
  })
})
