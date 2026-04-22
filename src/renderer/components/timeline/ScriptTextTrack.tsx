import { useState, useCallback } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { useScriptStore } from '../../stores/script-store'
import { useLibraryStore } from '../../stores/library-store'
import { timeToPixel } from './timeline-utils'
import { InlineTextPopup } from './InlineTextPopup'
import type { Segment } from '@shared/types'

interface ScriptTextTrackProps {
  zoomLevel: number
  scrollLeft: number
}

interface ScriptData {
  sectionId: string
  text: string
}

export function ScriptTextTrack({ zoomLevel, scrollLeft }: ScriptTextTrackProps): React.ReactNode {
  const timeline = useTimelineStore((s) => s.timeline)
  const clipScripts = useScriptStore((s) => s.clipScripts)
  const voiceovers = useScriptStore((s) => s.voiceovers)
  const clips = useLibraryStore((s) => s.clips)
  const updateSection = useScriptStore((s) => s.updateSection)
  const setClipScript = useScriptStore((s) => s.setClipScript)
  const adjustSegmentDuration = useTimelineStore((s) => s.adjustSegmentDuration)

  const [editingSegment, setEditingSegment] = useState<{
    segmentId: string
    sectionId: string
    clipId: string
    text: string
    position: { x: number; y: number }
  } | null>(null)

  // Get all non-overlay segments that have script sections
  const segments: Segment[] = timeline?.tracks
    .filter((t) => t.type === 'clip' || t.type === 'recording')
    .flatMap((t) => t.segments) ?? []

  const handleDoubleClick = useCallback(
    (
      e: React.MouseEvent,
      segmentId: string,
      sectionId: string,
      clipId: string,
      text: string,
    ) => {
      e.stopPropagation()
      setEditingSegment({
        segmentId,
        sectionId,
        clipId,
        text,
        position: { x: e.clientX, y: e.clientY },
      })
    },
    [],
  )

  const handleSave = useCallback(
    (newText: string) => {
      if (!editingSegment) return

      // Update section text in sections array
      updateSection(editingSegment.sectionId, { text: newText })

      // Also update the section in clipScripts
      const currentSections = clipScripts[editingSegment.clipId]
      if (currentSections) {
        const updatedSections = currentSections.map((s) =>
          s.id === editingSegment.sectionId ? { ...s, text: newText } : s,
        )
        setClipScript(editingSegment.clipId, updatedSections)
      }

      // Estimate new duration from word count (150 WPM)
      const wordCount = newText.split(/\s+/).filter(Boolean).length
      const estimatedDurationMs = Math.round((wordCount / 150) * 60 * 1000)
      if (estimatedDurationMs > 0) {
        adjustSegmentDuration(editingSegment.segmentId, estimatedDurationMs)
      }

      setEditingSegment(null)
    },
    [editingSegment, updateSection, setClipScript, clipScripts, adjustSegmentDuration],
  )

  function getScriptData(segment: Segment): (ScriptData & { clipId: string }) | null {
    // Try metadata first (set by splitClipBySections)
    if (segment.metadata) {
      try {
        const meta = JSON.parse(segment.metadata) as { sectionId?: string; sectionOrder?: number }
        if (meta.sectionId) {
          for (const [clipId, sections] of Object.entries(clipScripts)) {
            const section = sections.find((s) => s.id === meta.sectionId)
            if (section) return { sectionId: section.id, text: section.text, clipId }
          }
        }
      } catch {
        // invalid metadata — fall through to clip lookup
      }
    }

    // Fallback: find clip by sourceFile, get first section
    const clip = clips.find((c) => c.filePath === segment.sourceFile)
    if (clip && clipScripts[clip.id]?.[0]) {
      const section = clipScripts[clip.id][0]
      return { sectionId: section.id, text: section.text, clipId: clip.id }
    }

    return null
  }

  if (segments.length === 0) return null

  // Check if any segment has script data — if none, don't render the row
  const hasAnyScript = segments.some((seg) => getScriptData(seg) !== null)
  if (!hasAnyScript) return null

  return (
    <div className="script-text-track">
      <div style={{ position: 'relative', transform: `translateX(-${scrollLeft}px)` }}>
        {segments.map((segment) => {
          const scriptData = getScriptData(segment)
          if (!scriptData) return null

          const left = timeToPixel(segment.startTime, zoomLevel, 0)
          const width = timeToPixel(segment.endTime - segment.startTime, zoomLevel, 0)

          const isStale = voiceovers[scriptData.sectionId]?.stale === true

          return (
            <div
              key={segment.id}
              className={`script-text-segment${isStale ? ' stale' : ''}`}
              style={{
                position: 'absolute',
                left,
                width: Math.max(width, 20),
                height: 40,
                top: 4,
              }}
              onDoubleClick={(e) =>
                handleDoubleClick(e, segment.id, scriptData.sectionId, scriptData.clipId, scriptData.text)
              }
              title={scriptData.text}
            >
              {scriptData.text}
            </div>
          )
        })}
      </div>

      {editingSegment && (
        <InlineTextPopup
          text={editingSegment.text}
          voiceProfileId={null}
          position={editingSegment.position}
          onSave={(text) => handleSave(text)}
          onClose={() => setEditingSegment(null)}
        />
      )}
    </div>
  )
}
