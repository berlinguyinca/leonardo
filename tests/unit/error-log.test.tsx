// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorLog } from '@renderer/components/script-view/ErrorLog'
import React from 'react'

const sampleError = {
  error: 'Model timeout after 30s',
  provider: 'claude',
  model: 'claude-3-opus',
  promptPreview: 'Generate a narration script for...',
  fullPrompt: 'Generate a narration script for this recording of a user clicking the login button and navigating to the dashboard.',
  stack: 'Error: Model timeout after 30s\n  at AIProvider.generate (ai-provider.ts:42)',
  timestamp: 1712800000000,
}

describe('ErrorLog', () => {
  it('renders error details when error prop provided', () => {
    const { container } = render(<ErrorLog error={sampleError} />)

    expect(screen.getByText('AI Error')).toBeTruthy()
    expect(screen.getByText('claude')).toBeTruthy()
    expect(screen.getByText('claude-3-opus')).toBeTruthy()
    expect(screen.getByText('Model timeout after 30s')).toBeTruthy()
    expect(screen.getByText('Generate a narration script for...')).toBeTruthy()
    expect(container.querySelector('.error-log')).toBeTruthy()
  })

  it('renders nothing when error is null', () => {
    const { container } = render(<ErrorLog error={null} />)
    expect(container.querySelector('.error-log')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('copy button copies formatted error report', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    })

    const { container } = render(<ErrorLog error={sampleError} />)
    const copyBtn = container.querySelector('.copy-error-btn')!
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledTimes(1)
    const report = writeTextMock.mock.calls[0][0] as string
    expect(report).toContain('[Leonardo AI Error Report]')
    expect(report).toContain('Provider: claude')
    expect(report).toContain('Model: claude-3-opus')
    expect(report).toContain('Error: Model timeout after 30s')
    expect(report).toContain('Prompt: Generate a narration script for this recording')
    expect(report).toContain('Stack: Error: Model timeout after 30s')
  })

  it('shows N/A for stack when not provided', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    })

    const errorNoStack = { ...sampleError, stack: undefined }
    const { container } = render(<ErrorLog error={errorNoStack} />)
    const copyBtn = container.querySelector('.copy-error-btn')!
    fireEvent.click(copyBtn)

    const report = writeTextMock.mock.calls[0][0] as string
    expect(report).toContain('Stack: N/A')
  })
})
