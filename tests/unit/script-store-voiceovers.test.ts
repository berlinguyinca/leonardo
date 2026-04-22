// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { useScriptStore } from '../../src/renderer/stores/script-store'
import type { ScriptSection } from '@shared/types/ai'

function makeSection(overrides: Partial<ScriptSection> = {}): ScriptSection {
  return {
    id: 'sec-1',
    text: 'Hello world section text.',
    order: 0,
    eventIds: [],
    voiceProfileId: 'default',
    ...overrides,
  } as ScriptSection
}

describe('script-store: voiceover tracking', () => {
  beforeEach(() => {
    // Reset store state between tests
    useScriptStore.setState({
      sections: [],
      clipScripts: {},
      voiceovers: {},
    })
  })

  describe('setVoiceover', () => {
    it('stores filePath and textHash for a sectionId', () => {
      useScriptStore.getState().setVoiceover('sec-1', '/tmp/vo-sec1.mp3', 'abc123hash')

      const { voiceovers } = useScriptStore.getState()
      expect(voiceovers['sec-1']).toEqual({
        filePath: '/tmp/vo-sec1.mp3',
        textHash: 'abc123hash',
        stale: false,
      })
    })

    it('sets stale to false initially', () => {
      useScriptStore.getState().setVoiceover('sec-2', '/tmp/vo-sec2.mp3', 'hash456')

      const { voiceovers } = useScriptStore.getState()
      expect(voiceovers['sec-2'].stale).toBe(false)
    })

    it('overwrites an existing voiceover entry', () => {
      useScriptStore.getState().setVoiceover('sec-1', '/tmp/old.mp3', 'oldhash')
      useScriptStore.getState().setVoiceover('sec-1', '/tmp/new.mp3', 'newhash')

      const { voiceovers } = useScriptStore.getState()
      expect(voiceovers['sec-1'].filePath).toBe('/tmp/new.mp3')
      expect(voiceovers['sec-1'].textHash).toBe('newhash')
      expect(voiceovers['sec-1'].stale).toBe(false)
    })

    it('stores multiple section voiceovers independently', () => {
      useScriptStore.getState().setVoiceover('sec-a', '/tmp/a.mp3', 'hash-a')
      useScriptStore.getState().setVoiceover('sec-b', '/tmp/b.mp3', 'hash-b')

      const { voiceovers } = useScriptStore.getState()
      expect(voiceovers['sec-a'].filePath).toBe('/tmp/a.mp3')
      expect(voiceovers['sec-b'].filePath).toBe('/tmp/b.mp3')
    })
  })

  describe('markVoiceoverStale', () => {
    it('sets stale=true for an existing voiceover', () => {
      useScriptStore.getState().setVoiceover('sec-1', '/tmp/vo.mp3', 'hash123')
      useScriptStore.getState().markVoiceoverStale('sec-1')

      const { voiceovers } = useScriptStore.getState()
      expect(voiceovers['sec-1'].stale).toBe(true)
    })

    it('preserves filePath and textHash when marking stale', () => {
      useScriptStore.getState().setVoiceover('sec-1', '/tmp/vo.mp3', 'hash123')
      useScriptStore.getState().markVoiceoverStale('sec-1')

      const { voiceovers } = useScriptStore.getState()
      expect(voiceovers['sec-1'].filePath).toBe('/tmp/vo.mp3')
      expect(voiceovers['sec-1'].textHash).toBe('hash123')
    })

    it('does nothing when voiceover does not exist for sectionId', () => {
      // No voiceover set for 'ghost-sec'
      useScriptStore.getState().markVoiceoverStale('ghost-sec')

      const { voiceovers } = useScriptStore.getState()
      expect(voiceovers['ghost-sec']).toBeUndefined()
    })

    it('only marks the targeted section stale, not others', () => {
      useScriptStore.getState().setVoiceover('sec-a', '/tmp/a.mp3', 'hash-a')
      useScriptStore.getState().setVoiceover('sec-b', '/tmp/b.mp3', 'hash-b')

      useScriptStore.getState().markVoiceoverStale('sec-a')

      const { voiceovers } = useScriptStore.getState()
      expect(voiceovers['sec-a'].stale).toBe(true)
      expect(voiceovers['sec-b'].stale).toBe(false)
    })
  })

  describe('updateSection marks voiceover stale when text changes', () => {
    it('marks existing voiceover stale when text is updated', () => {
      // Set up sections
      useScriptStore.setState({
        sections: [makeSection({ id: 'sec-1', text: 'Original text.' })],
        voiceovers: {},
      })

      // Add a voiceover for the section
      useScriptStore.getState().setVoiceover('sec-1', '/tmp/vo.mp3', 'originalhash')

      // Update the section text — voiceover should become stale
      useScriptStore.getState().updateSection('sec-1', { text: 'Updated text.' })

      const { voiceovers } = useScriptStore.getState()
      expect(voiceovers['sec-1'].stale).toBe(true)
    })

    it('does NOT mark voiceover stale when non-text field is updated', () => {
      useScriptStore.setState({
        sections: [makeSection({ id: 'sec-1', text: 'Original.' })],
        voiceovers: {},
      })

      useScriptStore.getState().setVoiceover('sec-1', '/tmp/vo.mp3', 'myhash')

      // Update only the order, not text
      useScriptStore.getState().updateSection('sec-1', { order: 5 })

      const { voiceovers } = useScriptStore.getState()
      // stale should remain false since text was not changed
      expect(voiceovers['sec-1'].stale).toBe(false)
    })

    it('does NOT create a voiceover entry when section has none and text changes', () => {
      useScriptStore.setState({
        sections: [makeSection({ id: 'sec-1', text: 'Original.' })],
        voiceovers: {}, // no voiceover for sec-1
      })

      useScriptStore.getState().updateSection('sec-1', { text: 'Changed text.' })

      const { voiceovers } = useScriptStore.getState()
      // No voiceover should be created
      expect(voiceovers['sec-1']).toBeUndefined()
    })
  })

  describe('clearSections does not clear voiceovers', () => {
    it('voiceovers persist after clearSections', () => {
      useScriptStore.setState({
        sections: [makeSection({ id: 'sec-1', text: 'Hello.' })],
        voiceovers: {},
      })

      useScriptStore.getState().setVoiceover('sec-1', '/tmp/vo.mp3', 'hash123')

      // Clear sections
      useScriptStore.getState().clearSections()

      const state = useScriptStore.getState()
      expect(state.sections).toHaveLength(0)
      // Voiceovers remain for cache purposes
      expect(state.voiceovers['sec-1']).toBeDefined()
      expect(state.voiceovers['sec-1'].filePath).toBe('/tmp/vo.mp3')
    })

    it('multiple voiceovers all persist after clearSections', () => {
      useScriptStore.getState().setVoiceover('sec-a', '/tmp/a.mp3', 'hash-a')
      useScriptStore.getState().setVoiceover('sec-b', '/tmp/b.mp3', 'hash-b')

      useScriptStore.getState().clearSections()

      const { voiceovers } = useScriptStore.getState()
      expect(voiceovers['sec-a']).toBeDefined()
      expect(voiceovers['sec-b']).toBeDefined()
    })
  })
})
