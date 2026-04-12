import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockWebContents = {
  on: vi.fn(),
  off: vi.fn(),
  executeJavaScript: vi.fn().mockResolvedValue(undefined),
}

// Mock electron
vi.mock('electron', () => ({
  webContents: {
    fromId: () => mockWebContents,
  },
}))

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).slice(2, 8),
}))

import {
  startCapture,
  stopCapture,
  getCapturedEvents,
  handleDOMEvent,
  isLeonardoEvent,
} from '@main/services/dom-capture'

describe('dom-capture', () => {
  beforeEach(() => {
    // Reset state by stopping any captures
    stopCapture(999)
    mockWebContents.on.mockClear()
    mockWebContents.off.mockClear()
    mockWebContents.executeJavaScript.mockClear()
  })

  describe('isLeonardoEvent', () => {
    it('returns true for valid leonardo events', () => {
      expect(
        isLeonardoEvent({
          __leonardoEvent: true,
          type: 'click',
          timestamp: 1000,
          elementSelector: 'button',
          coordinates: { x: 100, y: 200 },
        }),
      ).toBe(true)
    })

    it('returns false for non-leonardo messages', () => {
      expect(isLeonardoEvent({ type: 'click' })).toBe(false)
      expect(isLeonardoEvent(null)).toBe(false)
      expect(isLeonardoEvent('string')).toBe(false)
      expect(isLeonardoEvent(42)).toBe(false)
      expect(isLeonardoEvent({})).toBe(false)
    })
  })

  describe('capture lifecycle', () => {
    it('starts with empty events', () => {
      startCapture(100)
      expect(getCapturedEvents(100)).toEqual([])
      stopCapture(100)
    })

    it('removes the did-finish-load listener when capture stops', () => {
      startCapture(700)
      expect(mockWebContents.on).toHaveBeenCalledWith('did-finish-load', expect.any(Function))

      stopCapture(700)

      expect(mockWebContents.off).toHaveBeenCalledWith('did-finish-load', expect.any(Function))
    })

    it('collects DOM events during capture', () => {
      startCapture(200)

      handleDOMEvent(200, {
        __leonardoEvent: true,
        type: 'click',
        timestamp: 1000,
        elementSelector: 'button.submit',
        coordinates: { x: 100, y: 200 },
        elementText: 'Submit',
      })

      handleDOMEvent(200, {
        __leonardoEvent: true,
        type: 'navigate',
        timestamp: 2000,
        elementSelector: '',
        coordinates: { x: 0, y: 0 },
        url: 'https://example.com/page2',
      })

      const events = getCapturedEvents(200)
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('click')
      expect(events[0].elementSelector).toBe('button.submit')
      expect(events[1].type).toBe('navigate')
      expect(events[1].url).toBe('https://example.com/page2')

      stopCapture(200)
    })

    it('assigns unique IDs to each event', () => {
      startCapture(300)

      handleDOMEvent(300, {
        __leonardoEvent: true,
        type: 'click',
        timestamp: 1000,
        elementSelector: 'a',
        coordinates: { x: 0, y: 0 },
      })

      handleDOMEvent(300, {
        __leonardoEvent: true,
        type: 'click',
        timestamp: 2000,
        elementSelector: 'a',
        coordinates: { x: 0, y: 0 },
      })

      const events = getCapturedEvents(300)
      expect(events[0].id).not.toBe(events[1].id)

      stopCapture(300)
    })

    it('stopCapture returns all captured events', () => {
      startCapture(400)

      handleDOMEvent(400, {
        __leonardoEvent: true,
        type: 'click',
        timestamp: 1000,
        elementSelector: 'div',
        coordinates: { x: 50, y: 50 },
      })

      const events = stopCapture(400)
      expect(events).toHaveLength(1)

      // After stop, events should be cleared for this webContentsId
      expect(getCapturedEvents(400)).toEqual([])
    })

    it('calls onEvent callback for each captured event', () => {
      const onEvent = vi.fn()
      startCapture(500, onEvent)

      handleDOMEvent(500, {
        __leonardoEvent: true,
        type: 'focus',
        timestamp: 1000,
        elementSelector: 'input.email',
        coordinates: { x: 200, y: 300 },
      })

      expect(onEvent).toHaveBeenCalledTimes(1)
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'focus',
          elementSelector: 'input.email',
        }),
      )

      stopCapture(500)
    })

    it('ignores events for non-captured webContents', () => {
      startCapture(600)

      handleDOMEvent(999, {
        __leonardoEvent: true,
        type: 'click',
        timestamp: 1000,
        elementSelector: 'a',
        coordinates: { x: 0, y: 0 },
      })

      expect(getCapturedEvents(600)).toEqual([])
      stopCapture(600)
    })
  })
})
