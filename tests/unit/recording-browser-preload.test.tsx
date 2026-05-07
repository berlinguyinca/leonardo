// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'

// Mock the recording store before importing the component
vi.mock('../../src/renderer/stores/recording-store', () => ({
  useRecordingStore: vi.fn((selector) => {
    const state = {
      currentUrl: 'https://example.com',
      setCurrentUrl: vi.fn(),
      targetResolution: { width: 1920, height: 1080 },
    }
    return selector(state)
  }),
}))

// Stub RecordingControls to avoid its complex dependencies
vi.mock('../../src/renderer/components/browser/RecordingControls', () => ({
  RecordingControls: () => <div data-testid="recording-controls" />,
}))

let preloadPathResolve: (value: string) => void
let preloadPathReject: (reason: Error) => void

beforeEach(() => {
  ;(window as Record<string, unknown>).leonardo = {
    recording: {
      getWebviewPreloadPath: vi.fn(
        () =>
          new Promise<string>((resolve, reject) => {
            preloadPathResolve = resolve
            preloadPathReject = reject
          }),
      ),
      relayDomEvent: vi.fn(),
    },
  }
})

afterEach(() => {
  delete (window as Record<string, unknown>).leonardo
  vi.restoreAllMocks()
})

// Import AFTER mocks are set up
import { RecordingBrowser } from '../../src/renderer/components/browser/RecordingBrowser'

describe('RecordingBrowser preload gating', () => {
  it('does not render webview before preload path resolves', () => {
    const { container } = render(<RecordingBrowser />)
    const webview = container.querySelector('webview')
    expect(webview).toBeNull()
    // Should show loading state
    const loading = container.querySelector('.browser-loading')
    expect(loading).not.toBeNull()
  })

  it('renders webview with preload attribute after path resolves', async () => {
    const { container } = render(<RecordingBrowser />)

    await act(async () => {
      preloadPathResolve('file:///path/to/preload.js')
    })

    const webview = container.querySelector('webview')
    expect(webview).not.toBeNull()
    expect(webview?.getAttribute('preload')).toBe('file:///path/to/preload.js')
    // Loading should be gone
    const loading = container.querySelector('.browser-loading')
    expect(loading).toBeNull()
  })

  it('shows error state when getWebviewPreloadPath fails', async () => {
    const { container } = render(<RecordingBrowser />)

    await act(async () => {
      preloadPathReject(new Error('IPC failed'))
    })

    const webview = container.querySelector('webview')
    expect(webview).toBeNull()
    const error = container.querySelector('.browser-loading')
    expect(error).not.toBeNull()
    expect(error?.textContent).toMatch(/failed|error|unable/i)
  })
})
