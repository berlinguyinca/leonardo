// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from '@renderer/stores/project-store'
import { makeProject } from '@test/factories'

describe('renderer project-store (Zustand)', () => {
  beforeEach(() => {
    // Reset store to initial state
    useProjectStore.setState({
      projects: [],
      activeProjectId: null,
      loading: false,
    })
  })

  it('initial state has empty projects array and null activeProjectId', () => {
    const state = useProjectStore.getState()
    expect(state.projects).toEqual([])
    expect(state.activeProjectId).toBeNull()
    expect(state.loading).toBe(false)
  })

  it('setProjects replaces the project list', () => {
    const projects = [makeProject({ id: 'p1' }), makeProject({ id: 'p2' })]
    useProjectStore.getState().setProjects(projects)
    expect(useProjectStore.getState().projects).toHaveLength(2)
    expect(useProjectStore.getState().projects[0].id).toBe('p1')
  })

  it('setActiveProject sets activeProjectId', () => {
    useProjectStore.getState().setActiveProject('proj-abc')
    expect(useProjectStore.getState().activeProjectId).toBe('proj-abc')
  })

  it('setActiveProject accepts null', () => {
    useProjectStore.getState().setActiveProject('proj-abc')
    useProjectStore.getState().setActiveProject(null)
    expect(useProjectStore.getState().activeProjectId).toBeNull()
  })

  it('addProject appends to the list', () => {
    const p1 = makeProject({ id: 'p1' })
    const p2 = makeProject({ id: 'p2' })
    useProjectStore.getState().addProject(p1)
    useProjectStore.getState().addProject(p2)
    const { projects } = useProjectStore.getState()
    expect(projects).toHaveLength(2)
    expect(projects[1].id).toBe('p2')
  })

  it('updateProject updates a matching project by ID', () => {
    const p1 = makeProject({ id: 'p1', name: 'Old Name' })
    useProjectStore.getState().addProject(p1)
    useProjectStore.getState().updateProject('p1', { name: 'New Name' })
    const updated = useProjectStore.getState().projects.find((p) => p.id === 'p1')
    expect(updated?.name).toBe('New Name')
  })

  it('updateProject does not affect other projects', () => {
    const p1 = makeProject({ id: 'p1', name: 'Alpha' })
    const p2 = makeProject({ id: 'p2', name: 'Beta' })
    useProjectStore.getState().setProjects([p1, p2])
    useProjectStore.getState().updateProject('p1', { name: 'Updated Alpha' })
    const p2After = useProjectStore.getState().projects.find((p) => p.id === 'p2')
    expect(p2After?.name).toBe('Beta')
  })

  it('removeProject removes the project by ID', () => {
    const p1 = makeProject({ id: 'p1' })
    const p2 = makeProject({ id: 'p2' })
    useProjectStore.getState().setProjects([p1, p2])
    useProjectStore.getState().removeProject('p1')
    expect(useProjectStore.getState().projects).toHaveLength(1)
    expect(useProjectStore.getState().projects[0].id).toBe('p2')
  })

  it('removeProject clears activeProjectId when it matches the removed project', () => {
    const p1 = makeProject({ id: 'p1' })
    useProjectStore.getState().setProjects([p1])
    useProjectStore.getState().setActiveProject('p1')
    useProjectStore.getState().removeProject('p1')
    expect(useProjectStore.getState().activeProjectId).toBeNull()
  })

  it('removeProject does not clear activeProjectId for a different project', () => {
    const p1 = makeProject({ id: 'p1' })
    const p2 = makeProject({ id: 'p2' })
    useProjectStore.getState().setProjects([p1, p2])
    useProjectStore.getState().setActiveProject('p2')
    useProjectStore.getState().removeProject('p1')
    expect(useProjectStore.getState().activeProjectId).toBe('p2')
  })
})
