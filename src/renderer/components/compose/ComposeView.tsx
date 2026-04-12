import { useCallback, useRef } from 'react'
import { StoryboardPanel } from './StoryboardPanel'
import { PlaybackPanel } from '../preview/PlaybackPanel'

export function ComposeView(): React.ReactNode {
  const dividerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftWidthRef = useRef(40) // percentage
  const isDragging = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - containerRect.left) / containerRect.width) * 100
      const clamped = Math.max(20, Math.min(70, pct))
      leftWidthRef.current = clamped

      const left = containerRef.current.querySelector('.compose-left') as HTMLElement | null
      const right = containerRef.current.querySelector('.compose-right') as HTMLElement | null
      if (left) left.style.width = `${clamped}%`
      if (right) right.style.width = `${100 - clamped}%`
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  return (
    <div
      ref={containerRef}
      className="compose-view"
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        background: '#111111',
      }}
    >
      {/* Left: Storyboard */}
      <div className="compose-left" style={{ width: '40%', minWidth: 0, overflow: 'hidden' }}>
        <StoryboardPanel />
      </div>

      {/* Resize divider */}
      <div
        ref={dividerRef}
        className="compose-resize-divider"
        onMouseDown={handleMouseDown}
        style={{
          width: 4,
          cursor: 'col-resize',
          background: '#252525',
          flexShrink: 0,
        }}
      />

      {/* Right: Preview */}
      <div className="compose-right" style={{ width: '60%', minWidth: 0, overflow: 'hidden' }}>
        <PlaybackPanel />
      </div>
    </div>
  )
}
