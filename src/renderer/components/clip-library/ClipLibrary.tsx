import { useEffect } from 'react'
import { useLibraryStore } from '../../stores/library-store'

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
    </div>
  )
}
