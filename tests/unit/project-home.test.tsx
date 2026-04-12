// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { useProjectStore } from '../../src/renderer/stores/project-store'
import { useUIStore } from '../../src/renderer/stores/ui-store'
import type { Project } from '@shared/types'

function makeProject(overrides?: Partial<Project>): Project {
  return {
    id: 'p-1',
    name: 'Test Project',
    inputMode: 'record-first',
    status: 'draft',
    createdAt: '2026-04-10T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z',
    recordingResolution: { width: 1920, height: 1080, label: '1080p' },
    exportConfig: null,
    ...overrides,
  }
}

beforeEach(() => {
  ;(window as Record<string, unknown>).leonardo = {
    project: {
      list: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
    },
    settings: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    },
  }
  useProjectStore.setState({ projects: [], activeProjectId: null })
})

afterEach(() => {
  delete (window as Record<string, unknown>).leonardo
})

import { ProjectHome } from '../../src/renderer/components/project/ProjectHome'

describe('ProjectHome', () => {
  it('shows empty state when no projects exist', () => {
    useProjectStore.setState({ projects: [] })
    const { container } = render(<ProjectHome />)
    expect(container.textContent).toMatch(/create your first project/i)
  })

  it('renders project cards when projects exist', () => {
    useProjectStore.setState({
      projects: [
        makeProject({ id: 'p-1', name: 'Project Alpha' }),
        makeProject({ id: 'p-2', name: 'Project Beta' }),
      ],
    })
    const { container } = render(<ProjectHome />)
    expect(container.textContent).toContain('Project Alpha')
    expect(container.textContent).toContain('Project Beta')
  })

  it('clicking a project card sets it as active', () => {
    useProjectStore.setState({
      projects: [makeProject({ id: 'p-1', name: 'Alpha' })],
    })
    const { container } = render(<ProjectHome />)
    const card = container.querySelector('.project-card')
    expect(card).not.toBeNull()
    fireEvent.click(card!)
    expect(useProjectStore.getState().activeProjectId).toBe('p-1')
  })

  it('clicking New Project opens the project wizard', () => {
    useProjectStore.setState({ projects: [] })
    const { container } = render(<ProjectHome />)
    const btn = container.querySelector('.wizard-btn-create')!
    expect(btn).not.toBeNull()
    fireEvent.click(btn)
    expect(useUIStore.getState().showProjectWizard).toBe(true)
  })

  it('clicking delete button removes project from store', async () => {
    useProjectStore.setState({
      projects: [makeProject({ id: 'p-1', name: 'Alpha' })],
    })
    const { container } = render(<ProjectHome />)
    const deleteBtn = container.querySelector('.project-card-delete')
    expect(deleteBtn).not.toBeNull()
    fireEvent.click(deleteBtn!)
    // Confirm deletion
    const confirmBtn = screen.getByText(/confirm/i)
    fireEvent.click(confirmBtn)
    // Wait for async delete
    await vi.waitFor(() => {
      expect(useProjectStore.getState().projects).toHaveLength(0)
    })
  })
})
