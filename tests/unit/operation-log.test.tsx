// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useComposeStore } from '@renderer/stores/compose-store'
import { OperationLog } from '@renderer/components/script-view/OperationLog'
import React from 'react'

function setupWindowMock() {
  const mockAi = {
    onStreamChunk: vi.fn(),
    removeStreamListeners: vi.fn(),
  }
  ;(window as Record<string, unknown>).leonardo = { ai: mockAi }
  return mockAi
}

beforeEach(() => {
  useComposeStore.setState({
    generationLog: [],
    isGenerating: false,
  })
  setupWindowMock()
})

afterEach(() => {
  delete (window as Record<string, unknown>).leonardo
})

describe('OperationLog', () => {
  it('renders log entries from compose store', () => {
    useComposeStore.setState({
      generationLog: [
        { timestamp: 1712800000000, level: 'info', message: 'Starting generation...' },
        { timestamp: 1712800001000, level: 'info', message: 'Processing step 1' },
      ],
    })

    render(<OperationLog />)
    expect(screen.getByText('Starting generation...')).toBeTruthy()
    expect(screen.getByText('Processing step 1')).toBeTruthy()
  })

  it('toggles collapsed state', () => {
    useComposeStore.setState({
      generationLog: [
        { timestamp: 1712800000000, level: 'info', message: 'Log entry visible' },
      ],
    })

    const { container } = render(<OperationLog />)

    // Initially expanded — entries visible
    expect(container.querySelector('.operation-log-entries')).toBeTruthy()

    // Click header to collapse
    const header = container.querySelector('.operation-log-header')!
    fireEvent.click(header)

    // Entries should be hidden
    expect(container.querySelector('.operation-log-entries')).toBeNull()

    // Click again to expand
    fireEvent.click(header)
    expect(container.querySelector('.operation-log-entries')).toBeTruthy()
  })

  it('copy button copies log to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    })

    useComposeStore.setState({
      generationLog: [
        { timestamp: 1712800000000, level: 'info', message: 'Hello' },
      ],
    })

    const { container } = render(<OperationLog />)
    const copyBtn = container.querySelector('.copy-all-btn')!
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledTimes(1)
    const copiedText = writeTextMock.mock.calls[0][0] as string
    expect(copiedText).toContain('[INFO]')
    expect(copiedText).toContain('Hello')
  })

  it('shows elapsed time while generating', () => {
    vi.useFakeTimers()
    useComposeStore.setState({ isGenerating: true })

    const { container } = render(<OperationLog />)

    act(() => {
      vi.advanceTimersByTime(2500)
    })

    const elapsedEl = container.querySelector('.elapsed-time')
    expect(elapsedEl).toBeTruthy()
    // Should show some elapsed time string (e.g. "0:02")
    expect(elapsedEl!.textContent).toBeTruthy()

    vi.useRealTimers()
  })

  it('color-codes entries by level', () => {
    useComposeStore.setState({
      generationLog: [
        { timestamp: 1712800000000, level: 'info', message: 'Info msg' },
        { timestamp: 1712800001000, level: 'warn', message: 'Warn msg' },
        { timestamp: 1712800002000, level: 'error', message: 'Error msg' },
      ],
    })

    const { container } = render(<OperationLog />)

    const entries = container.querySelectorAll('.log-entry')
    expect(entries.length).toBe(3)
    expect(entries[0].classList.contains('log-entry-info')).toBe(true)
    expect(entries[1].classList.contains('log-entry-warn')).toBe(true)
    expect(entries[2].classList.contains('log-entry-error')).toBe(true)
  })

  it('subscribes to stream chunks via window.leonardo.ai', () => {
    const mockAi = (
      (window as Record<string, unknown>).leonardo as { ai: { onStreamChunk: ReturnType<typeof vi.fn>; removeStreamListeners: ReturnType<typeof vi.fn> } }
    ).ai

    render(<OperationLog />)
    expect(mockAi.onStreamChunk).toHaveBeenCalledTimes(1)
  })
})
