// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { DOMEvent } from '@shared/types/events'

// seekTo must be module-level so the hoisted vi.mock factory can close over it
const seekTo = vi.fn()

vi.mock('../../src/renderer/hooks/usePlayhead', () => ({
  usePlayhead: () => ({ seekTo }),
}))

// Import component AFTER the mock is declared (hoisting handles the rest)
import { InteractionsPanel } from '../../src/renderer/components/properties/InteractionsPanel'

const SEGMENT_START = 10000

function makeClickEvent(overrides: Partial<DOMEvent> = {}): DOMEvent {
  return {
    id: 'evt-1',
    type: 'click',
    timestamp: 1_000_000,
    elementSelector: 'button.submit',
    coordinates: { x: 100, y: 200 },
    elementText: 'Submit',
    ...overrides,
  }
}

describe('InteractionsPanel', () => {
  beforeEach(() => {
    seekTo.mockClear()
  })

  afterEach(() => {
    delete (window as Record<string, unknown>).leonardo
  })

  it('shows placeholder when no events are recorded', async () => {
    ;(window as Record<string, unknown>).leonardo = {
      clip: { getEvents: vi.fn().mockResolvedValue([]) },
    }
    render(<InteractionsPanel clipId="clip-1" segmentStartTime={SEGMENT_START} />)
    await waitFor(() => {
      expect(screen.getByText(/No click events recorded/i)).toBeDefined()
    })
  })

  it('renders click event rows', async () => {
    const events: DOMEvent[] = [
      makeClickEvent({ id: 'e1', timestamp: 5000, elementText: 'Login' }),
      makeClickEvent({ id: 'e2', timestamp: 8000, elementText: 'Sign Up' }),
    ]
    ;(window as Record<string, unknown>).leonardo = {
      clip: { getEvents: vi.fn().mockResolvedValue(events) },
    }
    render(<InteractionsPanel clipId="clip-1" segmentStartTime={SEGMENT_START} />)
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeDefined()
      expect(screen.getByText('Sign Up')).toBeDefined()
    })
  })

  it('filters non-click events', async () => {
    const events: DOMEvent[] = [
      makeClickEvent({ id: 'e1', timestamp: 5000, elementText: 'Login' }),
      { ...makeClickEvent({ id: 'e2', timestamp: 6000, elementText: 'Scroll' }), type: 'scroll' },
    ]
    ;(window as Record<string, unknown>).leonardo = {
      clip: { getEvents: vi.fn().mockResolvedValue(events) },
    }
    render(<InteractionsPanel clipId="clip-1" segmentStartTime={SEGMENT_START} />)
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeDefined()
    })
    expect(screen.queryByText('Scroll')).toBeNull()
  })

  it('clicking a row calls seekTo at segmentStart + relMs', async () => {
    const firstTs = 1_000_000
    const events: DOMEvent[] = [
      makeClickEvent({ id: 'e1', timestamp: firstTs, elementText: 'First' }),
      makeClickEvent({ id: 'e2', timestamp: firstTs + 3000, elementText: 'Second' }),
    ]
    ;(window as Record<string, unknown>).leonardo = {
      clip: { getEvents: vi.fn().mockResolvedValue(events) },
    }
    render(<InteractionsPanel clipId="clip-1" segmentStartTime={SEGMENT_START} />)
    await waitFor(() => screen.getByText('Second'))

    fireEvent.click(screen.getByText('Second'))
    // relMs = 3000; segmentStart = 10000 → seek to 13000
    expect(seekTo).toHaveBeenCalledWith(13000)
  })

  it('shows placeholder when bridge is unavailable', () => {
    delete (window as Record<string, unknown>).leonardo
    render(<InteractionsPanel clipId="clip-1" segmentStartTime={SEGMENT_START} />)
    // Bridge guard prevents IPC call; placeholder renders immediately
    expect(screen.getByText('Interactions')).toBeDefined()
  })
})
