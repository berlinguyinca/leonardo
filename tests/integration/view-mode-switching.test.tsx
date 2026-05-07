// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'
import { ViewModeToggle } from '@renderer/components/layout/ViewModeToggle'

describe('ViewModeToggle (integration)', () => {
  beforeEach(() => {
    useUIStore.setState({ editorView: 'inline' })
  })

  it('renders two view buttons', () => {
    render(<ViewModeToggle />)
    expect(screen.getByText('Script')).toBeDefined()
    expect(screen.getByText('Timeline')).toBeDefined()
  })

  it('highlights the active view', () => {
    render(<ViewModeToggle />)
    const timelineBtn = screen.getByText('Timeline')
    expect(timelineBtn.classList.contains('active')).toBe(true)
  })

  it('switches view on click and updates store', () => {
    render(<ViewModeToggle />)
    fireEvent.click(screen.getByText('Script'))
    expect(useUIStore.getState().editorView).toBe('script-only')

    fireEvent.click(screen.getByText('Timeline'))
    expect(useUIStore.getState().editorView).toBe('inline')
  })

  it('persists view state across re-renders', () => {
    const { rerender } = render(<ViewModeToggle />)
    fireEvent.click(screen.getByText('Script'))
    rerender(<ViewModeToggle />)
    const scriptBtn = screen.getByText('Script')
    expect(scriptBtn.classList.contains('active')).toBe(true)
  })

  it('supports keyboard shortcut Cmd+1/2', () => {
    render(<ViewModeToggle />)

    fireEvent.keyDown(window, { key: '1', metaKey: true })
    expect(useUIStore.getState().editorView).toBe('script-only')

    fireEvent.keyDown(window, { key: '2', metaKey: true })
    expect(useUIStore.getState().editorView).toBe('inline')
  })
})
