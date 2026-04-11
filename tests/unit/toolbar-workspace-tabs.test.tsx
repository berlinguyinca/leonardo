// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'
import { Toolbar } from '@renderer/components/layout/Toolbar'

describe('Toolbar — workspace tabs', () => {
  beforeEach(() => {
    useUIStore.setState({ workspacePreset: 'editing', theme: 'dark' })
    ;(window as Record<string, unknown>).leonardo = undefined
  })

  it('renders LEONARDO brand in centre', () => {
    render(<Toolbar />)
    expect(screen.getByText('LEONARDO')).toBeDefined()
  })

  it('renders three workspace tab buttons', () => {
    render(<Toolbar />)
    expect(screen.getByTitle('Switch to recording workspace')).toBeDefined()
    expect(screen.getByTitle('Switch to editing workspace')).toBeDefined()
    expect(screen.getByTitle('Switch to export workspace')).toBeDefined()
  })

  it('active workspace tab has workspace-tab-active class', () => {
    render(<Toolbar />)
    const editTab = screen.getByTitle('Switch to editing workspace')
    expect(editTab.classList.contains('workspace-tab-active')).toBe(true)
  })

  it('clicking a tab calls setWorkspacePreset', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByTitle('Switch to recording workspace'))
    expect(useUIStore.getState().workspacePreset).toBe('recording')
  })

  it('renders menu items on the left', () => {
    const { container } = render(<Toolbar />)
    const menuItems = container.querySelectorAll('.toolbar-menu-item')
    const labels = [...menuItems].map((el) => el.textContent)
    expect(labels).toContain('File')
    expect(labels).toContain('Edit')
    expect(labels).toContain('View')
    expect(labels).toContain('Playback')
  })
})
