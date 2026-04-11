import { useEffect, useState } from 'react'
import type { Clip } from '@shared/types/events'
import type { Project } from '@shared/types'
import { useLibraryStore } from '../../stores/library-store'
import { useTimelineStore } from '../../stores/timeline-store'
import { useUIStore } from '../../stores/ui-store'
import { useProjectStore } from '../../stores/project-store'
import { ClipContextMenu } from './ClipContextMenu'

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(minutes)}:${pad(seconds % 60)}`
}

function truncateUrl(url: string, maxLength = 30): string {
  if (url.length <= maxLength) return url
  return url.slice(0, maxLength - 3) + '...'
}

function ProjectHeader({
  projectId,
  projects,
  clipCount,
}: {
  projectId: string | null
  projects: Project[]
  clipCount: number
}): React.ReactNode {
  const project = projects.find((p) => p.id === projectId)
  if (!project) {
    return <div className="clip-library-project-header">No project selected</div>
  }
  return (
    <div className="clip-library-project-header">
      <span className="project-name">{project.name}</span>
      <span className="clip-count">{clipCount} clip{clipCount !== 1 ? 's' : ''}</span>
    </div>
  )
}

export function ClipLibrary(): React.ReactNode {
  const clips = useLibraryStore((s) => s.clips)
  const highlightedClipId = useLibraryStore((s) => s.highlightedClipId)
  const setHighlightedClip = useLibraryStore((s) => s.setHighlightedClip)
  const loadClips = useLibraryStore((s) => s.loadClips)
  const addClipToTimeline = useTimelineStore((s) => s.addClipToTimeline)
  const setEditorView = useUIStore((s) => s.setEditorView)
  const setTimelineCollapsed = useUIStore((s) => s.setTimelineCollapsed)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const projects = useProjectStore((s) => s.projects)
  const [contextMenu, setContextMenu] = useState<{ clip: Clip; x: number; y: number } | null>(null)

  useEffect(() => {
    loadClips(activeProjectId ?? undefined)
  }, [loadClips, activeProjectId])

  useEffect(() => {
    if (!highlightedClipId) return
    const timer = setTimeout(() => setHighlightedClip(null), 3000)
    return () => clearTimeout(timer)
  }, [highlightedClipId, setHighlightedClip])

  return (
    <div className="clip-library">
      <ProjectHeader projectId={activeProjectId} projects={projects} clipCount={clips.length} />

      {clips.length === 0 ? (
        <p className="panel-placeholder">
          No clips yet. Start recording to add clips.
        </p>
      ) : (
        clips.map((clip) => (
          <div
            key={clip.id}
            className={`clip-card ${highlightedClipId === clip.id ? 'clip-highlighted' : ''}`}
            draggable
            onDoubleClick={() => {
              addClipToTimeline(clip)
              setEditorView('inline')
              setTimelineCollapsed(false)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({ clip, x: e.clientX, y: e.clientY })
            }}
            onDragStart={(e) => {
              e.dataTransfer.setData('application/clip-id', clip.id)
              e.dataTransfer.effectAllowed = 'copy'
            }}
          >
            <div className="clip-card-label">{clip.label}</div>
            <div className="clip-card-meta">
              <span>{formatDuration(clip.duration)}</span>
              <span>{truncateUrl(clip.url)}</span>
            </div>
            <div className="clip-card-date">
              {new Date(clip.createdAt).toLocaleString()}
            </div>
          </div>
        ))
      )}

      {contextMenu && (
        <ClipContextMenu
          clip={contextMenu.clip}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
