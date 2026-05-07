// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useProjectStore } from '../../src/renderer/stores/project-store'
import { useScriptStore } from '../../src/renderer/stores/script-store'
import { useUIStore } from '../../src/renderer/stores/ui-store'
import type { Script, ScriptSection } from '@shared/types/ai'

const mockLoadProjectScripts = vi.fn()
const mockWorkspacePreset = 'compose'

vi.mock('../../src/renderer/stores/script-store', () => ({
  useScriptStore: (selector: (s: { loadProjectScripts: typeof mockLoadProjectScripts }) => unknown) =>
    selector({ loadProjectScripts: mockLoadProjectScripts }),
}))

vi.mock('../../src/renderer/stores/ui-store', () => ({
  useUIStore: (selector: (s: { workspacePreset: string }) => unknown) =>
    selector({ workspacePreset: mockWorkspacePreset }),
}))

vi.mock('../../src/renderer/components/layout/Toolbar', () => ({
  Toolbar: () => null,
}))

vi.mock('../../src/renderer/components/layout/PanelSystem', () => ({
  PanelSystem: () => null,
}))

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

function makeScript(overrides: Partial<Script> = {}): Script & { sections: ScriptSection[] } {
  return {
    id: 'script-1',
    projectId: 'proj-1',
    clipId: 'clip-1',
    sections: [makeSection()],
    aiBackendUsed: 'claude',
    prompt: 'test prompt',
    generatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('Workspace — load project scripts on activeProjectId change', () => {
  let mockListByProject: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    mockListByProject = vi.fn()
    mockLoadProjectScripts.mockClear()
    ;(window as Record<string, unknown>).leonardo = {
      script: { listByProject: mockListByProject },
    }
    // Reset project store
    useProjectStore.setState({ activeProjectId: null })
    // Delay import until mocks are set up
  })

  it('calls listByProject when activeProjectId is set', async () => {
    mockListByProject.mockResolvedValue([makeScript()])

    const { Workspace } = await import('../../src/renderer/components/layout/Workspace')

    await act(async () => {
      useProjectStore.setState({ activeProjectId: 'proj-1' })
      render(<Workspace />)
    })

    expect(mockListByProject).toHaveBeenCalledWith('proj-1')
  })

  it('calls loadProjectScripts with only scripts that have a clipId', async () => {
    const scriptWithClip = makeScript({ clipId: 'clip-1' })
    const scriptWithoutClip = makeScript({ id: 'script-2', clipId: undefined })
    mockListByProject.mockResolvedValue([scriptWithClip, scriptWithoutClip])

    const { Workspace } = await import('../../src/renderer/components/layout/Workspace')

    await act(async () => {
      useProjectStore.setState({ activeProjectId: 'proj-1' })
      render(<Workspace />)
    })

    expect(mockLoadProjectScripts).toHaveBeenCalledOnce()
    const calledWith = mockLoadProjectScripts.mock.calls[0][0] as Array<{ clipId: string; sections: ScriptSection[] }>
    expect(calledWith).toHaveLength(1)
    expect(calledWith[0].clipId).toBe('clip-1')
    expect(calledWith[0].sections).toEqual(scriptWithClip.sections)
  })

  it('does NOT call listByProject when activeProjectId is null', async () => {
    const { Workspace } = await import('../../src/renderer/components/layout/Workspace')

    await act(async () => {
      useProjectStore.setState({ activeProjectId: null })
      render(<Workspace />)
    })

    expect(mockListByProject).not.toHaveBeenCalled()
    expect(mockLoadProjectScripts).not.toHaveBeenCalled()
  })

  it('does not throw when listByProject rejects', async () => {
    mockListByProject.mockRejectedValue(new Error('network error'))

    const { Workspace } = await import('../../src/renderer/components/layout/Workspace')

    await act(async () => {
      useProjectStore.setState({ activeProjectId: 'proj-1' })
      render(<Workspace />)
    })

    // Component renders without throwing and loadProjectScripts is never called
    expect(mockLoadProjectScripts).not.toHaveBeenCalled()
  })
})
