// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { sectionsToHtml, htmlToSections } from '../../src/renderer/components/script-editor/ScriptEditorPanel'

describe('ScriptEditorPanel — section parsing', () => {
  it('sectionsToHtml converts sections to heading + paragraph HTML', () => {
    const sections = [
      { id: 's1', scriptId: 'sc1', text: 'Welcome to this tutorial.', voiceProfileId: null, startTime: 0, endTime: 5000, timingMarkers: [], order: 0 },
      { id: 's2', scriptId: 'sc1', text: 'Click the settings icon.', voiceProfileId: null, startTime: 5000, endTime: 10000, timingMarkers: [], order: 1 },
    ]
    const html = sectionsToHtml(sections)
    expect(html).toContain('<h2>Section 1</h2>')
    expect(html).toContain('<p>Welcome to this tutorial.</p>')
    expect(html).toContain('<h2>Section 2</h2>')
    expect(html).toContain('<p>Click the settings icon.</p>')
  })

  it('htmlToSections parses heading-delimited HTML back to sections', () => {
    const html = '<h2>Section 1</h2><p>First section text.</p><h2>Section 2</h2><p>Second section text.</p>'
    const sections = htmlToSections(html)
    expect(sections).toHaveLength(2)
    expect(sections[0].text).toBe('First section text.')
    expect(sections[0].order).toBe(0)
    expect(sections[1].text).toBe('Second section text.')
    expect(sections[1].order).toBe(1)
  })

  it('htmlToSections handles merged sections (header deleted)', () => {
    const html = '<h2>Section 1</h2><p>First paragraph.</p><p>Second paragraph merged in.</p>'
    const sections = htmlToSections(html)
    expect(sections).toHaveLength(1)
    expect(sections[0].text).toContain('First paragraph.')
    expect(sections[0].text).toContain('Second paragraph merged in.')
  })

  it('htmlToSections handles new header insertion (split)', () => {
    const html = '<h2>Section 1</h2><p>Before split.</p><h2>Section 2</h2><p>After split.</p><h2>Section 3</h2><p>Third.</p>'
    const sections = htmlToSections(html)
    expect(sections).toHaveLength(3)
  })

  it('sectionsToHtml returns placeholder when no sections', () => {
    const html = sectionsToHtml([])
    expect(html).toContain('No script generated')
  })
})
