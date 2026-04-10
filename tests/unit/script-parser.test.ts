import { describe, it, expect } from 'vitest'
import { parseScriptText, extractTimingMarkers } from '@main/services/ai/script-parser'

describe('extractTimingMarkers', () => {
  it('extracts PAUSE markers with duration', () => {
    const result = extractTimingMarkers('Welcome to this tutorial. [PAUSE 1.5] Now let me show you.')
    expect(result.markers).toHaveLength(1)
    expect(result.markers[0].type).toBe('pause')
    expect(result.markers[0].duration).toBe(1.5)
    expect(result.cleanText).not.toContain('[PAUSE')
  })

  it('extracts ZOOM markers with selector', () => {
    const result = extractTimingMarkers('Click the button [ZOOM .submit-btn] to submit.')
    expect(result.markers).toHaveLength(1)
    expect(result.markers[0].type).toBe('zoom')
    expect(result.markers[0].selector).toBe('.submit-btn')
    expect(result.cleanText).not.toContain('[ZOOM')
  })

  it('extracts FREEZE markers with duration', () => {
    const result = extractTimingMarkers('Notice this area [FREEZE 2.0] carefully.')
    expect(result.markers).toHaveLength(1)
    expect(result.markers[0].type).toBe('freeze')
    expect(result.markers[0].duration).toBe(2.0)
  })

  it('extracts TRANSITION markers with type', () => {
    const result = extractTimingMarkers('[TRANSITION fade] Now moving to the next step.')
    expect(result.markers).toHaveLength(1)
    expect(result.markers[0].type).toBe('transition')
    expect(result.markers[0].transitionType).toBe('fade')
  })

  it('extracts multiple markers from one text', () => {
    const text = 'Welcome. [PAUSE 1.0] Click here [ZOOM #btn] and wait [FREEZE 3.0] for the result.'
    const result = extractTimingMarkers(text)
    expect(result.markers).toHaveLength(3)
    expect(result.markers.map((m) => m.type)).toEqual(['pause', 'zoom', 'freeze'])
    expect(result.cleanText).not.toContain('[')
  })

  it('is case-insensitive for marker names', () => {
    const result = extractTimingMarkers('[pause 1.0] [Zoom .btn] [FREEZE 2.0] [transition cut]')
    expect(result.markers).toHaveLength(4)
  })

  it('returns empty markers for plain text', () => {
    const result = extractTimingMarkers('Just a normal paragraph without any markers.')
    expect(result.markers).toHaveLength(0)
    expect(result.cleanText).toBe('Just a normal paragraph without any markers.')
  })
})

describe('parseScriptText', () => {
  it('parses numbered sections', () => {
    const text = `1. Welcome to this tutorial. We will learn how to use forms.

2. First, click on the email field. [ZOOM input.email]

3. Now type your email address and click submit. [FREEZE 2.0]`

    const sections = parseScriptText(text, 'sc-1')
    expect(sections).toHaveLength(3)
    expect(sections[0].text).toContain('Welcome to this tutorial')
    expect(sections[1].timingMarkers).toHaveLength(1)
    expect(sections[1].timingMarkers[0].type).toBe('zoom')
    expect(sections[2].timingMarkers).toHaveLength(1)
    expect(sections[2].timingMarkers[0].type).toBe('freeze')
  })

  it('parses paragraph-separated sections', () => {
    const text = `Welcome to this tutorial.

Now let me show you the dashboard.

Finally, we'll export the results.`

    const sections = parseScriptText(text, 'sc-2')
    expect(sections).toHaveLength(3)
  })

  it('treats a single block as one section', () => {
    const text = 'This is a simple one-section script with no breaks.'
    const sections = parseScriptText(text, 'sc-3')
    expect(sections).toHaveLength(1)
    expect(sections[0].text).toBe(text)
  })

  it('assigns correct scriptId and order', () => {
    const text = `1. First section.
2. Second section.
3. Third section.`

    const sections = parseScriptText(text, 'my-script-id')
    expect(sections.every((s) => s.scriptId === 'my-script-id')).toBe(true)
    expect(sections.map((s) => s.order)).toEqual([0, 1, 2])
  })

  it('assigns unique IDs to sections', () => {
    const text = `1. Section A.
2. Section B.`

    const sections = parseScriptText(text, 'sc-ids')
    const ids = sections.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('initializes voiceProfileId as null', () => {
    const text = '1. A section.'
    const sections = parseScriptText(text, 'sc-voice')
    expect(sections[0].voiceProfileId).toBeNull()
  })

  it('skips empty sections', () => {
    const text = `1. Real section.

2.

3. Another real section.`

    const sections = parseScriptText(text, 'sc-empty')
    expect(sections.length).toBeGreaterThanOrEqual(2)
    expect(sections.every((s) => s.text.trim().length > 0)).toBe(true)
  })
})
