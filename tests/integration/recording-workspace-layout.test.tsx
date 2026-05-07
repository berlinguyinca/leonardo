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
vi.mock('@renderer/components/script-editor/InlineEditorView', () => ({
  InlineEditorView: () => <div data-testid="inline-editor">InlineEditor</div>,
}))
vi.mock('@renderer/components/compose/ComposeView', () => ({
  ComposeView: () => <div data-testid="compose-view">ComposeView</div>,
}))
vi.mock('@renderer/components/script-view/ScriptPresetView', () => ({
  ScriptPresetView: () => <div data-testid="script-preset-view">ScriptPresetView</div>,
}))
vi.mock('@renderer/components/preview/PlaybackPanel', () => ({
  PlaybackPanel: () => <div data-testid="playback-panel">PlaybackPanel</div>,
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

  describe('PanelSystem in compose preset', () => {
    it('renders the timeline panel', () => {
      const { container } = render(<PanelSystem preset="compose" />)
      expect(container.querySelector('.panel-timeline')).not.toBeNull()
    })

    it('renders the timeline resize handle', () => {
      const { container } = render(<PanelSystem preset="compose" />)
      expect(container.querySelector('.resize-handle-h')).not.toBeNull()
    })
  })

  describe('Toolbar recording preset', () => {
    it('does not render ViewModeToggle (Script/Split/Timeline buttons) in recording mode', () => {
      useUIStore.setState({ workspacePreset: 'recording' })
      render(<Toolbar />)
      expect(screen.queryByRole('tablist', { name: 'Editor view' })).toBeNull()
    })

    it('renders ViewModeToggle in compose mode', () => {
      useUIStore.setState({ workspacePreset: 'compose' })
      render(<Toolbar />)
      expect(screen.getByRole('tablist', { name: 'Editor view' })).toBeTruthy()
    })

    it('does not render ViewModeToggle in export mode', () => {
      useUIStore.setState({ workspacePreset: 'export' })
      render(<Toolbar />)
      expect(screen.queryByRole('tablist', { name: 'Editor view' })).toBeNull()
    })
  })
})
