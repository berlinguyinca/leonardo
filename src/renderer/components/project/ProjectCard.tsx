import type { Project } from '@shared/types'

interface ProjectCardProps {
  project: Project
  onOpen: () => void
  onDelete: () => void
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  recording: 'Recording',
  scripting: 'Scripting',
  syncing: 'Syncing',
  editing: 'Editing',
  rendering: 'Rendering',
  exported: 'Exported',
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps): React.ReactNode {
  return (
    <div className="project-card" onClick={onOpen} role="button" tabIndex={0}>
      <div className="project-card-header">
        <span className="project-card-name">{project.name}</span>
        <button
          className="project-card-delete"
          title="Delete project"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          &#x2715;
        </button>
      </div>
      <div className="project-card-meta">
        <span className={`project-card-status status-${project.status}`}>
          {STATUS_LABELS[project.status] ?? project.status}
        </span>
        <span className="project-card-resolution">
          {project.recordingResolution.label}
        </span>
      </div>
      <div className="project-card-time">
        {formatRelativeTime(project.updatedAt)}
      </div>
    </div>
  )
}
