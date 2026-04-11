import type { Segment } from '@shared/types'
import { useLibraryStore } from '../../stores/library-store'
import { InteractionsPanel } from './InteractionsPanel'

interface SegmentPropertiesProps {
  segment: Segment
}

export function SegmentProperties({ segment }: SegmentPropertiesProps): React.ReactNode {
  const clips = useLibraryStore((s) => s.clips)
  const clip = clips.find((c) => c.filePath === segment.sourceFile)

  return (
    <div className="properties-form">
      <div className="properties-section">
        <label className="properties-label">Label</label>
        <span className="properties-value">{segment.label}</span>
      </div>
      <div className="properties-section">
        <label className="properties-label">Start Time (ms)</label>
        <span className="properties-value">{segment.startTime}</span>
      </div>
      <div className="properties-section">
        <label className="properties-label">End Time (ms)</label>
        <span className="properties-value">{segment.endTime}</span>
      </div>
      <div className="properties-section">
        <label className="properties-label">Duration</label>
        <span className="properties-value">{segment.endTime - segment.startTime}ms</span>
      </div>
      <div className="properties-section">
        <label className="properties-label">Source</label>
        <span className="properties-value">{segment.sourceFile || 'N/A'}</span>
      </div>
      {clip && (
        <InteractionsPanel clipId={clip.id} segmentStartTime={segment.startTime} />
      )}
    </div>
  )
}
