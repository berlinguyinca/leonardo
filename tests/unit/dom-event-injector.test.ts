import { describe, it, expect } from 'vitest'
import { getDOMEventInjectionScript } from '@main/services/dom-event-injector'

describe('dom-event-injector', () => {
  it('returns a non-empty script string', () => {
    const script = getDOMEventInjectionScript()
    expect(typeof script).toBe('string')
    expect(script.length).toBeGreaterThan(100)
  })

  it('contains the guard variable to prevent double injection', () => {
    const script = getDOMEventInjectionScript()
    expect(script).toContain('__leonardoDOMCapture')
  })

  it('sets up event listeners for all required event types', () => {
    const script = getDOMEventInjectionScript()
    expect(script).toContain("'click'")
    expect(script).toContain("'submit'")
    expect(script).toContain("'focusin'")
    expect(script).toContain("'input'")
    expect(script).toContain("'scroll'")
  })

  it('hooks History API for navigation tracking', () => {
    const script = getDOMEventInjectionScript()
    expect(script).toContain('history.pushState')
    expect(script).toContain('history.replaceState')
    expect(script).toContain('popstate')
  })

  it('uses window.postMessage to emit events', () => {
    const script = getDOMEventInjectionScript()
    expect(script).toContain('window.postMessage')
    expect(script).toContain('__leonardoEvent')
  })

  it('generates CSS selectors for elements', () => {
    const script = getDOMEventInjectionScript()
    expect(script).toContain('getSelector')
    expect(script).toContain('CSS.escape')
  })

  it('throttles scroll events at 500ms', () => {
    const script = getDOMEventInjectionScript()
    expect(script).toContain('500')
    expect(script).toContain('scrollTimeout')
  })

  it('truncates element text to 100 characters', () => {
    const script = getDOMEventInjectionScript()
    expect(script).toContain('100')
    expect(script).toContain('substring')
  })

  it('is a self-executing function', () => {
    const script = getDOMEventInjectionScript().trim()
    expect(script).toMatch(/^\(function\(\)/)
    expect(script).toMatch(/\}\)\(\);$/)
  })
})
