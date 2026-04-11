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

describe('script-store: clipScripts', () => {
  beforeEach(() => {
    useScriptStore.setState({ sections: [], clipScripts: {} })
  })

  it('initial state: clipScripts starts as empty object', () => {
    expect(useScriptStore.getState().clipScripts).toEqual({})
  })

  describe('setClipScript', () => {
    it('stores sections under the given clipId', () => {
      const section = makeSection({ id: 'sec-1' })
      useScriptStore.getState().setClipScript('clip-1', [section])

      expect(useScriptStore.getState().clipScripts['clip-1']).toHaveLength(1)
      expect(useScriptStore.getState().clipScripts['clip-1'][0]).toEqual(section)
    })

    it('overwrites existing sections for the same clipId', () => {
      const section1 = makeSection({ id: 'sec-1', text: 'First' })
      const section2 = makeSection({ id: 'sec-2', text: 'Second' })
      useScriptStore.getState().setClipScript('clip-1', [section1])
      useScriptStore.getState().setClipScript('clip-1', [section2])

      const stored = useScriptStore.getState().clipScripts['clip-1']
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('sec-2')
    })

    it('stores sections for multiple clips independently', () => {
      const sec1 = makeSection({ id: 'sec-1' })
      const sec2 = makeSection({ id: 'sec-2' })
      useScriptStore.getState().setClipScript('clip-1', [sec1])
      useScriptStore.getState().setClipScript('clip-2', [sec2])

      expect(useScriptStore.getState().clipScripts['clip-1'][0].id).toBe('sec-1')
      expect(useScriptStore.getState().clipScripts['clip-2'][0].id).toBe('sec-2')
    })
  })

  describe('loadProjectScripts', () => {
    it('replaces all clipScripts with the provided array', () => {
      const sec1 = makeSection({ id: 'sec-1' })
      useScriptStore.getState().setClipScript('clip-old', [sec1])

      const sec2 = makeSection({ id: 'sec-2' })
      const sec3 = makeSection({ id: 'sec-3' })
      useScriptStore.getState().loadProjectScripts([
        { clipId: 'clip-a', sections: [sec2] },
        { clipId: 'clip-b', sections: [sec3] },
      ])

      const state = useScriptStore.getState()
      expect(state.clipScripts['clip-old']).toBeUndefined()
      expect(state.clipScripts['clip-a'][0].id).toBe('sec-2')
      expect(state.clipScripts['clip-b'][0].id).toBe('sec-3')
    })

    it('results in empty object when called with empty array', () => {
      const sec1 = makeSection({ id: 'sec-1' })
      useScriptStore.getState().setClipScript('clip-1', [sec1])

      useScriptStore.getState().loadProjectScripts([])

      expect(useScriptStore.getState().clipScripts).toEqual({})
    })
  })

  it('setClipScript does not affect existing sections state', () => {
    const section = makeSection({ id: 'sec-global' })
    useScriptStore.getState().setSections([section])

    useScriptStore.getState().setClipScript('clip-1', [makeSection({ id: 'sec-clip' })])

    expect(useScriptStore.getState().sections).toHaveLength(1)
    expect(useScriptStore.getState().sections[0].id).toBe('sec-global')
  })
})
