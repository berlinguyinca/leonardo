import { useEffect, useState } from 'react'
import type { Clip } from '@shared/types/events'
import { useLibraryStore } from '../../stores/library-store'
import { useTimelineStore } from '../../stores/timeline-store'
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

export function ClipLibrary(): React.ReactNode {
  const clips = useLibraryStore((s) => s.clips)
  const highlightedClipId = useLibraryStore((s) => s.highlightedClipId)
  const setHighlightedClip = useLibraryStore((s) => s.setHighlightedClip)
  const loadClips = useLibraryStore((s) => s.loadClips)
  const addClipToTimeline = useTimelineStore((s) => s.addClipToTimeline)
  const [contextMenu, setContextMenu] = useState<{ clip: Clip; x: number; y: number } | null>(null)

  useEffect(() => {
    loadClips()
  }, [loadClips])

  useEffect(() => {
    if (!highlightedClipId) return
    const timer = setTimeout(() => setHighlightedClip(null), 3000)
    return () => clearTimeout(timer)
  }, [highlightedClipId, setHighlightedClip])

  if (clips.length === 0) {
    return (
      <p className="panel-placeholder">
        No clips yet. Start recording to add clips.
      </p>
    )
  }

  return (
    <div className="clip-library">
      {clips.map((clip) => (
        <div
          key={clip.id}
          className={`clip-card ${highlightedClipId === clip.id ? 'clip-highlighted' : ''}`}
          draggable
          onDoubleClick={() => addClipToTimeline(clip)}
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
      ))}
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
