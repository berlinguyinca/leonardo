// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useScriptStore } from '@renderer/stores/script-store'
import { PanelSystem } from '@renderer/components/layout/PanelSystem'
import { Toolbar } from '@renderer/components/layout/Toolbar'

// Stub heavy sub-components to keep tests focused on layout conditions
vi.mock('@renderer/components/browser/RecordingBrowser', () => ({
  RecordingBrowser: () => <div data-testid="recording-browser">Browser</div>,
}))
vi.mock('@renderer/components/properties/PropertiesPanel', () => ({
  PropertiesPanel: () => <div data-testid="properties-panel">Properties</div>,
}))
vi.mock('@renderer/components/clip-library/ClipLibrary', () => ({
  ClipLibrary: () => <div data-testid="clip-library">Library</div>,
}))
vi.mock('@renderer/components/script-editor/ScriptOnlyView', () => ({
  ScriptOnlyView: () => <div data-testid="script-only">Script</div>,
}))
vi.mock('@renderer/components/script-editor/DualPaneView', () => ({
  DualPaneView: () => <div data-testid="dual-pane">DualPane</div>,
}))
vi.mock('@renderer/components/script-editor/InlineEditorView', () => ({
  InlineEditorView: () => <div data-testid="inline-editor">InlineEditor</div>,
}))

describe('recording workspace layout', () => {
  beforeEach(() => {
    useUIStore.setState({
      editorView: 'inline',
      timelineCollapsed: false,
      sidebarCollapsed: false,
      propertiesCollapsed: false,
      workspacePreset: 'recording',
      sidebarWidth: 280,
      timelineHeight: 240,
    })
    useScriptStore.setState({ sections: [] })
  })

  describe('PanelSystem in recording preset', () => {
    it('does not render the timeline panel', () => {
      const { container } = render(<PanelSystem preset="recording" />)
      expect(container.querySelector('.panel-timeline')).toBeNull()
    })

    it('does not render the timeline resize handle', () => {
      const { container } = render(<PanelSystem preset="recording" />)
      expect(container.querySelector('.resize-handle-h')).toBeNull()
    })

    it('renders the browser panel instead of preview', () => {
      render(<PanelSystem preset="recording" />)
      expect(screen.getByTestId('recording-browser')).toBeTruthy()
    })
  })

  describe('PanelSystem in editing preset', () => {
    it('renders the timeline panel', () => {
      const { container } = render(<PanelSystem preset="editing" />)
      expect(container.querySelector('.panel-timeline')).not.toBeNull()
    })

    it('renders the timeline resize handle', () => {
      const { container } = render(<PanelSystem preset="editing" />)
      expect(container.querySelector('.resize-handle-h')).not.toBeNull()
    })
  })

  describe('Toolbar recording preset', () => {
    it('does not render ViewModeToggle (Script/Split/Timeline buttons) in recording mode', () => {
      useUIStore.setState({ workspacePreset: 'recording' })
      render(<Toolbar />)
      expect(screen.queryByRole('tablist', { name: 'Editor view' })).toBeNull()
    })

    it('renders ViewModeToggle in editing mode', () => {
      useUIStore.setState({ workspacePreset: 'editing' })
      render(<Toolbar />)
      expect(screen.getByRole('tablist', { name: 'Editor view' })).toBeTruthy()
    })

    it('renders ViewModeToggle in export mode', () => {
      useUIStore.setState({ workspacePreset: 'export' })
      render(<Toolbar />)
      expect(screen.getByRole('tablist', { name: 'Editor view' })).toBeTruthy()
    })
  })
})
