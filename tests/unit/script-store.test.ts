import { describe, it, expect, beforeEach } from 'vitest'
import { useScriptStore } from '../../src/renderer/stores/script-store'
import type { ScriptSection } from '@shared/types/ai'

const mockSection: ScriptSection = {
  id: 'sec-1',
  scriptId: 'script-1',
  text: 'Hello world',
  voiceProfileId: null,
  startTime: 0,
  endTime: 5000,
  timingMarkers: [],
  order: 0,
}

describe('script-store', () => {
  beforeEach(() => {
    useScriptStore.setState({ sections: [] })
  })

  it('initial state: sections starts as empty array', () => {
    expect(useScriptStore.getState().sections).toEqual([])
  })

  describe('setSections', () => {
    it('replaces sections with provided array', () => {
      const section2: ScriptSection = { ...mockSection, id: 'sec-2', order: 1 }
      useScriptStore.getState().setSections([mockSection, section2])

      expect(useScriptStore.getState().sections).toHaveLength(2)
      expect(useScriptStore.getState().sections[0]).toEqual(mockSection)
      expect(useScriptStore.getState().sections[1]).toEqual(section2)
    })

    it('replaces existing sections with new array', () => {
      useScriptStore.getState().setSections([mockSection])
      const newSection: ScriptSection = { ...mockSection, id: 'sec-new', text: 'New text' }
      useScriptStore.getState().setSections([newSection])

      expect(useScriptStore.getState().sections).toHaveLength(1)
      expect(useScriptStore.getState().sections[0].id).toBe('sec-new')
    })
  })

  describe('clearSections', () => {
    it('resets sections to empty array', () => {
      useScriptStore.getState().setSections([mockSection])
      expect(useScriptStore.getState().sections).toHaveLength(1)

      useScriptStore.getState().clearSections()
      expect(useScriptStore.getState().sections).toEqual([])
    })
  })

  describe('updateSection', () => {
    it('merges partial updates into the matching section by id', () => {
      useScriptStore.getState().setSections([mockSection])
      useScriptStore.getState().updateSection('sec-1', { text: 'Updated text', endTime: 8000 })

      const updated = useScriptStore.getState().sections[0]
      expect(updated.text).toBe('Updated text')
      expect(updated.endTime).toBe(8000)
      expect(updated.startTime).toBe(0)
      expect(updated.id).toBe('sec-1')
    })

    it('no-op on unknown id: sections unchanged if id not found', () => {
      useScriptStore.getState().setSections([mockSection])
      useScriptStore.getState().updateSection('nonexistent-id', { text: 'Should not appear' })

      const sections = useScriptStore.getState().sections
      expect(sections).toHaveLength(1)
      expect(sections[0]).toEqual(mockSection)
    })
  })
})
