import { useState } from 'react'
import { useProjectStore } from '../../stores/project-store'
import { useUIStore } from '../../stores/ui-store'
import { ProjectCard } from './ProjectCard'

export function ProjectHome(): React.ReactNode {
  const projects = useProjectStore((s) => s.projects)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const removeProject = useProjectStore((s) => s.removeProject)
  const setShowProjectWizard = useUIStore((s) => s.setShowProjectWizard)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleOpen = (projectId: string) => {
    setActiveProject(projectId)
    window.leonardo?.settings?.set('lastActiveProjectId', projectId)
  }

  const handleDelete = async (projectId: string) => {
    await window.leonardo.project.delete(projectId)
    removeProject(projectId)
    setConfirmDeleteId(null)
  }

  if (projects.length === 0) {
    return (
      <div className="project-home">
        <div className="project-home-empty">
          <h2>Create your first project</h2>
          <p>Start by creating a new project to begin recording and editing.</p>
          <button
            className="wizard-btn wizard-btn-create"
            onClick={() => setShowProjectWizard(true)}
          >
            New Project
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="project-home">
      <div className="project-home-header">
        <h2>Projects</h2>
        <button
          className="wizard-btn wizard-btn-create"
          onClick={() => setShowProjectWizard(true)}
        >
          New Project
        </button>
      </div>
      <div className="project-grid">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onOpen={() => handleOpen(project.id)}
            onDelete={() => setConfirmDeleteId(project.id)}
          />
        ))}
      </div>

      {confirmDeleteId && (
        <div className="wizard-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="wizard-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="wizard-title">Delete Project?</h2>
            <p>This action cannot be undone.</p>
            <div className="wizard-actions">
              <button
                className="wizard-btn wizard-btn-cancel"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="wizard-btn wizard-btn-create"
                onClick={() => handleDelete(confirmDeleteId)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
