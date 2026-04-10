import { describe, it, expect } from 'vitest'
import { buildScriptPrompt, getSystemPrompt } from '@main/services/ai/prompt-templates'
import type { ScriptGenContext } from '@shared/types/ai'

describe('prompt-templates', () => {
  describe('getSystemPrompt', () => {
    it('returns a non-empty system prompt', () => {
      const prompt = getSystemPrompt()
      expect(prompt.length).toBeGreaterThan(100)
    })

    it('includes instructions for timing markers', () => {
      const prompt = getSystemPrompt()
      expect(prompt).toContain('[PAUSE')
      expect(prompt).toContain('[ZOOM')
      expect(prompt).toContain('[FREEZE')
      expect(prompt).toContain('[TRANSITION')
    })

    it('specifies script format (numbered sections)', () => {
      const prompt = getSystemPrompt()
      expect(prompt).toContain('numbered sections')
    })
  })

  describe('buildScriptPrompt', () => {
    it('includes the user prompt', () => {
      const context: ScriptGenContext = {
        domEvents: [],
        recordingDuration: 60000,
        url: 'https://example.com',
        userPrompt: 'Create a tutorial about form submission',
      }

      const prompt = buildScriptPrompt(context)
      expect(prompt).toContain('Create a tutorial about form submission')
    })

    it('includes recording metadata', () => {
      const context: ScriptGenContext = {
        domEvents: [],
        recordingDuration: 120000,
        url: 'https://app.example.com/dashboard',
        userPrompt: 'Show the dashboard',
      }

      const prompt = buildScriptPrompt(context)
      expect(prompt).toContain('https://app.example.com/dashboard')
      expect(prompt).toContain('120.0 seconds')
    })

    it('summarizes DOM events by type', () => {
      const context: ScriptGenContext = {
        domEvents: [
          {
            id: 'e1',
            type: 'click',
            timestamp: 2000,
            elementSelector: 'button.submit',
            coordinates: { x: 100, y: 200 },
            elementText: 'Submit',
          },
          {
            id: 'e2',
            type: 'navigate',
            timestamp: 5000,
            elementSelector: '',
            coordinates: { x: 0, y: 0 },
            url: 'https://example.com/success',
          },
          {
            id: 'e3',
            type: 'focus',
            timestamp: 1000,
            elementSelector: 'input.email',
            coordinates: { x: 300, y: 150 },
            elementText: 'Email address',
          },
        ],
        recordingDuration: 10000,
        url: 'https://example.com',
        userPrompt: 'Tutorial',
      }

      const prompt = buildScriptPrompt(context)
      expect(prompt).toContain('Click on "Submit"')
      expect(prompt).toContain('Navigate to: https://example.com/success')
      expect(prompt).toContain('Focus on input: Email address')
      expect(prompt).toContain('[2.0s]')
      expect(prompt).toContain('[5.0s]')
    })

    it('handles empty DOM events', () => {
      const context: ScriptGenContext = {
        domEvents: [],
        recordingDuration: 5000,
        url: 'https://example.com',
        userPrompt: 'Quick demo',
      }

      const prompt = buildScriptPrompt(context)
      expect(prompt).toContain('no DOM events captured')
    })
  })
})
