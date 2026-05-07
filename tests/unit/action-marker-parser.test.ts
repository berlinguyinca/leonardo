import { describe, it, expect } from 'vitest'
import { extractActionMarkers } from '@main/services/ai/script-parser'

describe('extractActionMarkers', () => {
  it('parses [ACTION: evt123 "Click submit"] correctly', () => {
    const text = 'Now click the button. [ACTION: evt123 "Click submit"]'
    const markers = extractActionMarkers(text)

    expect(markers).toHaveLength(1)
    expect(markers[0].eventId).toBe('evt123')
    expect(markers[0].label).toBe('Click submit')
    expect(markers[0].position).toBeGreaterThan(0)
  })

  it('handles multiple ACTION markers in text', () => {
    const text = `First [ACTION: evt-001 "Open menu"] then [ACTION: evt-002 "Select option"] and done.`
    const markers = extractActionMarkers(text)

    expect(markers).toHaveLength(2)
    expect(markers[0].eventId).toBe('evt-001')
    expect(markers[0].label).toBe('Open menu')
    expect(markers[1].eventId).toBe('evt-002')
    expect(markers[1].label).toBe('Select option')
  })

  it('returns empty array when no ACTION markers present', () => {
    const text = 'Just a normal paragraph without any action markers. [PAUSE 1.0]'
    const markers = extractActionMarkers(text)
    expect(markers).toHaveLength(0)
  })

  it('handles ACTION markers with hyphenated event IDs', () => {
    const text = '[ACTION: dom-click-42 "Click the login button"]'
    const markers = extractActionMarkers(text)

    expect(markers).toHaveLength(1)
    expect(markers[0].eventId).toBe('dom-click-42')
    expect(markers[0].label).toBe('Click the login button')
  })

  it('is case-insensitive for the ACTION keyword', () => {
    const text = '[action: evt1 "lowercase"] and [Action: evt2 "mixed case"]'
    const markers = extractActionMarkers(text)
    expect(markers).toHaveLength(2)
  })

  it('extractTimingMarkers removes ACTION markers from clean text', async () => {
    const { extractTimingMarkers } = await import('@main/services/ai/script-parser')
    const text = 'Click here [ACTION: evt1 "Click button"] to proceed.'
    const result = extractTimingMarkers(text)
    expect(result.cleanText).not.toContain('[ACTION')
    expect(result.cleanText).toContain('Click here')
    expect(result.cleanText).toContain('to proceed.')
  })

  it('parseScriptText includes actionMarkers on sections', async () => {
    const { parseScriptText } = await import('@main/services/ai/script-parser')
    const text = `1. Welcome to the tutorial. [ACTION: evt-001 "Open app"]

2. Now click the submit button. [ACTION: evt-002 "Click submit"]`

    const sections = parseScriptText(text, 'script-1')
    expect(sections).toHaveLength(2)
    expect(sections[0].actionMarkers).toHaveLength(1)
    expect(sections[0].actionMarkers![0].eventId).toBe('evt-001')
    expect(sections[1].actionMarkers).toHaveLength(1)
    expect(sections[1].actionMarkers![0].eventId).toBe('evt-002')
  })
})
