// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'

vi.mock('@renderer/components/browser/RecordingBrowser', () => ({
  RecordingBrowser: () => <div data-testid="recording-browser">RecordingBrowser</div>,
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

vi.mock('@renderer/components/properties/PropertiesPanel', () => ({
  PropertiesPanel: () => <div data-testid="properties-panel">PropertiesPanel</div>,
}))

vi.mock('@renderer/components/clip-library/ClipLibrary', () => ({
  ClipLibrary: () => <div data-testid="clip-library">ClipLibrary</div>,
}))

vi.mock('@renderer/components/script-editor/ScriptOnlyView', () => ({
  ScriptOnlyView: () => <div data-testid="script-only-view">ScriptOnlyView</div>,
}))

vi.mock('@renderer/components/script-editor/InlineEditorView', () => ({
  InlineEditorView: () => <div data-testid="inline-editor-view">InlineEditorView</div>,
}))

import { PanelSystem } from '@renderer/components/layout/PanelSystem'

describe('PanelSystem — compose & script layout routing', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarCollapsed: false,
      propertiesCollapsed: false,
      timelineCollapsed: false,
      sidebarWidth: 260,
      timelineHeight: 300,
    })
  })

  it('renders ComposeView when preset is compose', () => {
    render(<PanelSystem preset="compose" />)
    expect(screen.getByTestId('compose-view')).toBeDefined()
    expect(screen.queryByTestId('recording-browser')).toBeNull()
    expect(screen.queryByTestId('script-preset-view')).toBeNull()
    expect(screen.queryByTestId('playback-panel')).toBeNull()
  })

  it('renders ScriptPresetView when preset is script', () => {
    render(<PanelSystem preset="script" />)
    expect(screen.getByTestId('script-preset-view')).toBeDefined()
    expect(screen.queryByTestId('compose-view')).toBeNull()
    expect(screen.queryByTestId('recording-browser')).toBeNull()
    expect(screen.queryByTestId('playback-panel')).toBeNull()
  })

  it('renders RecordingBrowser when preset is recording', () => {
    render(<PanelSystem preset="recording" />)
    expect(screen.getByTestId('recording-browser')).toBeDefined()
    expect(screen.queryByTestId('compose-view')).toBeNull()
    expect(screen.queryByTestId('script-preset-view')).toBeNull()
    expect(screen.queryByTestId('playback-panel')).toBeNull()
  })

  it('renders PlaybackPanel when preset is export', () => {
    render(<PanelSystem preset="export" />)
    expect(screen.getByTestId('playback-panel')).toBeDefined()
    expect(screen.queryByTestId('compose-view')).toBeNull()
    expect(screen.queryByTestId('script-preset-view')).toBeNull()
    expect(screen.queryByTestId('recording-browser')).toBeNull()
  })

  it('hides timeline panel when preset is recording', () => {
    const { container } = render(<PanelSystem preset="recording" />)
    expect(container.querySelector('.panel-timeline')).toBeNull()
  })

  it('shows timeline panel when preset is compose', () => {
    const { container } = render(<PanelSystem preset="compose" />)
    expect(container.querySelector('.panel-timeline')).toBeDefined()
  })
})
