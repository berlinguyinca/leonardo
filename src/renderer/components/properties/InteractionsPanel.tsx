import { useState, useEffect } from 'react'
import type { DOMEvent } from '@shared/types/events'
import { usePlayhead } from '../../hooks/usePlayhead'

function hasBridge(): boolean {
  return typeof window !== 'undefined' && !!window.leonardo?.clip?.getEvents
}

function tagFromSelector(sel: string): string {
  const match = sel.match(/^([a-z][\w-]*)/i)
  return match ? match[1].toLowerCase() : '?'
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

interface InteractionsPanelProps {
  clipId: string
  segmentStartTime: number
}

export function InteractionsPanel({ clipId, segmentStartTime }: InteractionsPanelProps): React.ReactNode {
  const [events, setEvents] = useState<DOMEvent[]>([])
  const { seekTo } = usePlayhead()

  useEffect(() => {
    if (!hasBridge()) return
    window.leonardo.clip.getEvents(clipId).then(setEvents)
  }, [clipId])

  const clicks = events.filter((e) => e.type === 'click')
  const firstTs = clicks[0]?.timestamp ?? 0

  return (
    <div className="interactions-panel">
      <h4 className="interactions-title">Interactions</h4>
      {clicks.length === 0 ? (
        <p className="panel-placeholder">No click events recorded.</p>
      ) : (
        clicks.map((ev) => {
          const relMs = ev.timestamp - firstTs
          return (
            <div
              key={ev.id}
              className="interaction-row"
              onClick={() => seekTo(segmentStartTime + relMs)}
            >
              <span className="interaction-time">{formatMs(relMs)}</span>
              <span className="interaction-tag">[{tagFromSelector(ev.elementSelector)}]</span>
              <span className="interaction-label">{ev.elementText ?? ev.elementSelector}</span>
            </div>
          )
        })
      )}
    </div>
  )
}
