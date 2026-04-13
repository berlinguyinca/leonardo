// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { LogViewer } from '@renderer/components/settings/LogViewer'
import { useUIStore } from '@renderer/stores/ui-store'

function setupMocks(logText = 'INFO: app started'): { logRead: ReturnType<typeof vi.fn> } {
  const logRead = vi.fn().mockResolvedValue(logText)
  ;(window as Record<string, unknown>).leonardo = {
    log: { read: logRead },
  }
  navigator.clipboard = { writeText: vi.fn().mockResolvedValue(undefined) } as unknown as Clipboard
  return { logRead }
}

beforeEach(() => {
  useUIStore.setState({ showLogViewer: true, setShowLogViewer: (v: boolean) => useUIStore.setState({ showLogViewer: v }) } as Parameters<typeof useUIStore.setState>[0])
})

describe('LogViewer', () => {
  it('renders "Application Log" title', async () => {
    setupMocks()
    render(<LogViewer />)
    expect(screen.getByText('Application Log')).toBeTruthy()
  })

  it('calls log.read on mount to fetch the log', async () => {
    const { logRead } = setupMocks()
    render(<LogViewer />)
    await waitFor(() => expect(logRead).toHaveBeenCalledTimes(1))
  })

  it('displays the fetched log text in the pre element', async () => {
    setupMocks('INFO: startup complete\nWARN: low memory')
    const { container } = render(<LogViewer />)
    await waitFor(() => {
      const pre = container.querySelector('pre.log-viewer-content') as HTMLPreElement
      expect(pre.textContent).toContain('INFO: startup complete')
    })
  })

  it('Refresh button re-fetches the log', async () => {
    const { logRead } = setupMocks()
    render(<LogViewer />)
    await waitFor(() => expect(logRead).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByText('Refresh'))
    await waitFor(() => expect(logRead).toHaveBeenCalledTimes(2))
  })

  it('close button (×) calls setShowLogViewer(false)', async () => {
    setupMocks()
    const setShowLogViewer = vi.fn()
    useUIStore.setState({ setShowLogViewer } as Parameters<typeof useUIStore.setState>[0])
    render(<LogViewer />)
    fireEvent.click(screen.getByText('×'))
    expect(setShowLogViewer).toHaveBeenCalledWith(false)
  })

  it('Copy button copies log text to clipboard', async () => {
    setupMocks('copied log content')
    render(<LogViewer />)
    await waitFor(() => screen.getByText('Copy'))
    fireEvent.click(screen.getByText('Copy'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copied log content')
  })
})
