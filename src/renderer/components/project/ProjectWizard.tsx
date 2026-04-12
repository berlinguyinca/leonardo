import { useState } from 'react'
import { useUIStore } from '../../stores/ui-store'
import { useProjectStore } from '../../stores/project-store'
import type { InputModeType } from '@shared/types'
import { RESOLUTION_PRESETS } from '@shared/types'

const INPUT_MODES: { type: InputModeType; title: string; description: string }[] = [
  {
    type: 'record-first',
    title: 'Record First',
    description: 'Record your screen interactions, then describe what you did. AI generates the narration script.',
  },
  {
    type: 'prompt-first',
    title: 'Prompt First',
    description: 'Write your script first, then follow guided recording steps to capture matching footage.',
  },
  {
    type: 'simultaneous',
    title: 'Simultaneous',
    description: 'Record and annotate in real-time. AI polishes your annotations into a coherent script.',
  },
  {
    type: 'fully-automatic',
    title: 'Fully Automatic',
    description: 'Provide a URL and prompt. The system automates the browser and generates everything.',
  },
]

export function ProjectWizard(): React.ReactNode {
  const showProjectWizard = useUIStore((s) => s.showProjectWizard)
  const setShowProjectWizard = useUIStore((s) => s.setShowProjectWizard)
  const addProject = useProjectStore((s) => s.addProject)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)

  const [name, setName] = useState('')
  const [selectedMode, setSelectedMode] = useState<InputModeType>('record-first')
  const [selectedResolution, setSelectedResolution] = useState<string>('1080p')

  if (!showProjectWizard) return null

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    const resolution = RESOLUTION_PRESETS[selectedResolution]
    const project = await window.leonardo.project.create({
      name: trimmedName,
      inputMode: selectedMode,
      resolution,
    })
    addProject(project)
    setActiveProject(project.id)
    window.leonardo?.settings?.set('lastActiveProjectId', project.id)
    setShowProjectWizard(false)
    setName('')
    setSelectedMode('record-first')
    setSelectedResolution('1080p')
  }

  const handleCancel = () => {
    setShowProjectWizard(false)
    setName('')
  }

  return (
    <div className="wizard-overlay" onClick={handleCancel}>
      <div className="wizard-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="wizard-title">New Project</h2>

        {/* Project Name */}
        <div className="wizard-field">
          <label className="wizard-label">Project Name</label>
          <input
            className="wizard-input"
            type="text"
            placeholder="My Tutorial"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Input Mode Selection */}
        <div className="wizard-field">
          <label className="wizard-label">Input Mode</label>
          <div className="wizard-modes">
            {INPUT_MODES.map((mode) => (
              <button
                key={mode.type}
                className={`wizard-mode-card ${selectedMode === mode.type ? 'selected' : ''}`}
                onClick={() => setSelectedMode(mode.type)}
              >
                <span className="wizard-mode-title">{mode.title}</span>
                <span className="wizard-mode-desc">{mode.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Resolution */}
        <div className="wizard-field">
          <label className="wizard-label">Recording Resolution</label>
          <div className="wizard-resolutions">
            {Object.entries(RESOLUTION_PRESETS).map(([key, res]) => (
              <button
                key={key}
                className={`wizard-res-btn ${selectedResolution === key ? 'selected' : ''}`}
                onClick={() => setSelectedResolution(key)}
              >
                {res.label} ({res.width}x{res.height})
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="wizard-actions">
          <button className="wizard-btn wizard-btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button
            className="wizard-btn wizard-btn-create"
            onClick={handleCreate}
            disabled={!name.trim()}
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}
