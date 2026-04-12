import { describe, it, expect, beforeEach } from 'vitest'
import { useScriptStore } from '../../src/renderer/stores/script-store'
import type { ScriptSection } from '@shared/types/ai'

function makeSection(overrides: Partial<ScriptSection> = {}): ScriptSection {
  return {
    id: 'sec-1',
    scriptId: 'script-1',
    text: 'Hello world',
    voiceProfileId: null,
    startTime: 0,
    endTime: 5000,
    timingMarkers: [],
    order: 0,
    ...overrides,
  }
}

describe('script-store: event assignment and freeze override', () => {
  beforeEach(() => {
    useScriptStore.setState({ sections: [], clipScripts: {} })
  })

  describe('assignEventToSection', () => {
    it('adds eventId to a section with no existing eventIds', () => {
      const section = makeSection({ id: 'sec-1' })
      useScriptStore.getState().setSections([section])
      useScriptStore.getState().assignEventToSection('sec-1', 'evt-a')

      const updated = useScriptStore.getState().sections[0]
      expect(updated.eventIds).toEqual(['evt-a'])
    })

    it('does not duplicate an eventId already present in eventIds', () => {
      const section = makeSection({ id: 'sec-1', eventIds: ['evt-a'] })
      useScriptStore.getState().setSections([section])
      useScriptStore.getState().assignEventToSection('sec-1', 'evt-a')

      const updated = useScriptStore.getState().sections[0]
      expect(updated.eventIds).toEqual(['evt-a'])
    })

    it('appends a new eventId when others already exist', () => {
      const section = makeSection({ id: 'sec-1', eventIds: ['evt-a'] })
      useScriptStore.getState().setSections([section])
      useScriptStore.getState().assignEventToSection('sec-1', 'evt-b')

      const updated = useScriptStore.getState().sections[0]
      expect(updated.eventIds).toEqual(['evt-a', 'evt-b'])
    })
  })

  describe('removeEventFromSection', () => {
    it('removes an existing eventId from the section', () => {
      const section = makeSection({ id: 'sec-1', eventIds: ['evt-a', 'evt-b'] })
      useScriptStore.getState().setSections([section])
      useScriptStore.getState().removeEventFromSection('sec-1', 'evt-a')

      const updated = useScriptStore.getState().sections[0]
      expect(updated.eventIds).toEqual(['evt-b'])
    })

    it('handles gracefully when eventId is not present in eventIds', () => {
      const section = makeSection({ id: 'sec-1', eventIds: ['evt-a'] })
      useScriptStore.getState().setSections([section])
      useScriptStore.getState().removeEventFromSection('sec-1', 'evt-nonexistent')

      const updated = useScriptStore.getState().sections[0]
      expect(updated.eventIds).toEqual(['evt-a'])
    })

    it('handles gracefully when eventIds is undefined', () => {
      const section = makeSection({ id: 'sec-1' })
      useScriptStore.getState().setSections([section])
      useScriptStore.getState().removeEventFromSection('sec-1', 'evt-a')

      const updated = useScriptStore.getState().sections[0]
      expect(updated.eventIds).toEqual([])
    })
  })

  describe('setFreezeOverride', () => {
    it('sets freezeOverrideDuration on the matching section', () => {
      const section = makeSection({ id: 'sec-1' })
      useScriptStore.getState().setSections([section])
      useScriptStore.getState().setFreezeOverride('sec-1', 2000)

      const updated = useScriptStore.getState().sections[0]
      expect(updated.freezeOverrideDuration).toBe(2000)
    })

    it('clears freezeOverrideDuration when called with null', () => {
      const section = makeSection({ id: 'sec-1', freezeOverrideDuration: 3000 })
      useScriptStore.getState().setSections([section])
      useScriptStore.getState().setFreezeOverride('sec-1', null)

      const updated = useScriptStore.getState().sections[0]
      expect(updated.freezeOverrideDuration).toBeNull()
    })

    it('does not affect other sections when targeting by id', () => {
      const sec1 = makeSection({ id: 'sec-1' })
      const sec2 = makeSection({ id: 'sec-2' })
      useScriptStore.getState().setSections([sec1, sec2])
      useScriptStore.getState().setFreezeOverride('sec-1', 1500)

      const sections = useScriptStore.getState().sections
      expect(sections[0].freezeOverrideDuration).toBe(1500)
      expect(sections[1].freezeOverrideDuration).toBeUndefined()
    })
  })
})
