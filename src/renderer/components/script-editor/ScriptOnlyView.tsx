import { useCallback } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { SectionBlock } from './SectionBlock'
import type { ScriptSection } from '@shared/types'

interface ScriptOnlyViewProps {
  sections: ScriptSection[]
  onUpdateSection: (id: string, updates: Partial<ScriptSection>) => void
}

export function ScriptOnlyView({ sections, onUpdateSection }: ScriptOnlyViewProps): React.ReactNode {
  const selectedSectionId = useTimelineStore((s) => s.selectedSyncPointId)
  const setSelectedSection = useTimelineStore((s) => s.setSelectedSyncPoint)

  const handleTextChange = useCallback(
    (id: string, text: string) => { onUpdateSection(id, { text }) },
    [onUpdateSection],
  )

  const handleVoiceChange = useCallback(
    (id: string, voiceProfileId: string | null) => { onUpdateSection(id, { voiceProfileId }) },
    [onUpdateSection],
  )

  return (
    <div className="script-editor-container">
      {sections
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            isActive={selectedSectionId === section.id}
            onTextChange={(text) => handleTextChange(section.id, text)}
            onVoiceChange={(voice) => handleVoiceChange(section.id, voice)}
            onClick={() => setSelectedSection(section.id)}
          />
        ))}
    </div>
  )
}
