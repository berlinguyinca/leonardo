import { useCallback } from 'react'
import { useTimelineStore } from '../stores/timeline-store'
import type { ScriptSection } from '@shared/types'

export function useDualPaneSync(sections: ScriptSection[]) {
  const setSelectedSyncPoint = useTimelineStore((s) => s.setSelectedSyncPoint)

  const selectSection = useCallback(
    (sectionId: string) => {
      setSelectedSyncPoint(sectionId)
    },
    [setSelectedSyncPoint],
  )

  const getSectionAtTime = useCallback(
    (timeMs: number): ScriptSection | undefined => {
      return sections.find((s) => s.startTime <= timeMs && s.endTime >= timeMs)
    },
    [sections],
  )

  return { selectSection, getSectionAtTime }
}
