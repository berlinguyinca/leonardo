import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../src/renderer/stores/ui-store'

describe('ui-store panel collapse', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarCollapsed: false,
      propertiesCollapsed: false,
      timelineCollapsed: false,
      panelStateBeforeRecording: null,
    })
  })

  describe('individual collapse setters', () => {
    it('collapses sidebar', () => {
      useUIStore.getState().setSidebarCollapsed(true)
      expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    })

    it('collapses properties', () => {
      useUIStore.getState().setPropertiesCollapsed(true)
      expect(useUIStore.getState().propertiesCollapsed).toBe(true)
    })

    it('collapses timeline', () => {
      useUIStore.getState().setTimelineCollapsed(true)
      expect(useUIStore.getState().timelineCollapsed).toBe(true)
    })
  })

  describe('collapseAllPanels', () => {
    it('collapses all three panels', () => {
      useUIStore.getState().collapseAllPanels()

      const state = useUIStore.getState()
      expect(state.sidebarCollapsed).toBe(true)
      expect(state.propertiesCollapsed).toBe(true)
      expect(state.timelineCollapsed).toBe(true)
    })

    it('saves the prior panel state as a snapshot', () => {
      // Start with sidebar already collapsed
      useUIStore.getState().setSidebarCollapsed(true)
      useUIStore.getState().collapseAllPanels()

      const snapshot = useUIStore.getState().panelStateBeforeRecording
      expect(snapshot).toEqual({
        sidebarCollapsed: true,
        propertiesCollapsed: false,
        timelineCollapsed: false,
      })
    })
  })

  describe('restorePanelState', () => {
    it('restores panels from the saved snapshot', () => {
      // Start with sidebar collapsed, others expanded
      useUIStore.getState().setSidebarCollapsed(true)
      useUIStore.getState().collapseAllPanels()
      useUIStore.getState().restorePanelState()

      const state = useUIStore.getState()
      expect(state.sidebarCollapsed).toBe(true) // was already collapsed
      expect(state.propertiesCollapsed).toBe(false)
      expect(state.timelineCollapsed).toBe(false)
    })

    it('clears the snapshot after restoring', () => {
      useUIStore.getState().collapseAllPanels()
      useUIStore.getState().restorePanelState()

      expect(useUIStore.getState().panelStateBeforeRecording).toBeNull()
    })

    it('does nothing if no snapshot exists', () => {
      useUIStore.getState().setSidebarCollapsed(true)
      useUIStore.getState().restorePanelState()

      // Should remain unchanged
      expect(useUIStore.getState().sidebarCollapsed).toBe(true)
      expect(useUIStore.getState().propertiesCollapsed).toBe(false)
      expect(useUIStore.getState().timelineCollapsed).toBe(false)
    })
  })
})
