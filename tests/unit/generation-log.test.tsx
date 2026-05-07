// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GenerationLog } from '../../src/renderer/components/script-editor/GenerationLog'

const mockLog = {
  systemPrompt: 'You are a video tutorial scriptwriter.',
  userMessage: 'Generate a tutorial.\n\nRecording details:\n- URL: https://example.com\n- Duration: 30.0 seconds',
  rawResponse: '1. Welcome to this tutorial.\n\n2. Click the settings icon.',
  timestamp: '2026-04-13T10:00:00Z',
  provider: 'claude' as const,
}

describe('GenerationLog', () => {
  it('renders nothing when log is null', () => {
    const { container } = render(<GenerationLog log={null} onRegenerate={() => {}} />)
    expect(container.querySelector('.generation-log')).toBeNull()
  })

  it('renders collapsible sections when log exists', () => {
    render(<GenerationLog log={mockLog} onRegenerate={() => {}} />)
    expect(screen.getByText('System Prompt')).toBeInTheDocument()
    expect(screen.getByText('User Message')).toBeInTheDocument()
    expect(screen.getByText('AI Response')).toBeInTheDocument()
  })

  it('expands a section on click to show content', () => {
    render(<GenerationLog log={mockLog} onRegenerate={() => {}} />)
    fireEvent.click(screen.getByText('User Message'))
    expect(screen.getByText(/https:\/\/example\.com/)).toBeInTheDocument()
  })

  it('shows prompt input when regenerate button clicked', () => {
    render(<GenerationLog log={mockLog} onRegenerate={vi.fn()} />)
    fireEvent.click(screen.getByText('Regenerate with Custom Prompt'))
    const textarea = document.querySelector('.generation-log-prompt-input')
    expect(textarea).toBeTruthy()
  })
})
