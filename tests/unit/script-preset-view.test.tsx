// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useScriptStore } from '@renderer/stores/script-store'
import { useComposeStore } from '@renderer/stores/compose-store'
import { ScriptPresetView } from '@renderer/components/script-view/ScriptPresetView'
import React from 'react'

beforeEach(() => {
  useScriptStore.setState({ sections: [] })
  useComposeStore.setState({
    aiProvider: 'claude',
    isGenerating: false,
    generationLog: [],
  })
})

describe('ScriptPresetView', () => {
  it('renders script editor area (left pane)', () => {
    const { container } = render(<ScriptPresetView />)
    const editorPane = container.querySelector('.script-editor-pane')
    expect(editorPane).toBeTruthy()
    expect(screen.getByText('Script Editor')).toBeTruthy()
  })

  it('renders preview placeholder (right pane)', () => {
    const { container } = render(<ScriptPresetView />)
    const previewPane = container.querySelector('.playback-panel-container')
    expect(previewPane).toBeTruthy()
    expect(screen.getByText('Preview')).toBeTruthy()
  })

  it('has resize divider between panes', () => {
    const { container } = render(<ScriptPresetView />)
    const handles = container.querySelectorAll('.resize-handle')
    // Vertical (between left/right) + horizontal (between top/bottom)
    expect(handles.length).toBe(2)
    expect(container.querySelector('.resize-handle-v')).toBeTruthy()
    expect(container.querySelector('.resize-handle-h')).toBeTruthy()
  })

  it('renders timeline placeholder at bottom', () => {
    const { container } = render(<ScriptPresetView />)
    const timelineContainer = container.querySelector('.timeline-container')
    expect(timelineContainer).toBeTruthy()
    expect(screen.getByText('Timeline')).toBeTruthy()
  })

  it('renders script sections from store', () => {
    useScriptStore.setState({
      sections: [
        {
          id: 'sec-1',
          scriptId: 'script-1',
          text: 'Click the login button',
          voiceProfileId: null,
          startTime: 0,
          endTime: 3000,
          timingMarkers: [],
          order: 0,
          eventIds: ['evt-1'],
        },
      ],
    })

    const { container } = render(<ScriptPresetView />)
    expect(screen.getByText('Click the login button')).toBeTruthy()
    expect(screen.getByText('Step 1')).toBeTruthy()
    const chips = container.querySelectorAll('.event-chip')
    expect(chips.length).toBe(1)
    expect(chips[0].textContent).toBe('evt-1')
  })

  it('has generate button and backend selector', () => {
    const { container } = render(<ScriptPresetView />)
    expect(container.querySelector('.generate-btn')).toBeTruthy()
    expect(container.querySelector('.ai-backend-selector')).toBeTruthy()
  })

  it('disables generate button while generating', () => {
    useComposeStore.setState({ isGenerating: true })
    const { container } = render(<ScriptPresetView />)
    const btn = container.querySelector('.generate-btn') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('Generating...')
  })
})
