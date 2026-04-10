import { useState, useRef, useCallback } from 'react'
import { ScriptOnlyView } from './ScriptOnlyView'
import { TimelineMinimap } from '../timeline/TimelineMinimap'
import { ResizeDivider } from './ResizeDivider'
import { useScrollSync } from '../../hooks/useScrollSync'
import type { ScriptSection } from '@shared/types'

interface DualPaneViewProps {
  sections: ScriptSection[]
  onUpdateSection: (id: string, updates: Partial<ScriptSection>) => void
}

export function DualPaneView({ sections, onUpdateSection }: DualPaneViewProps): React.ReactNode {
  const [leftWidth, setLeftWidth] = useState(50)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const { syncScroll } = useScrollSync(leftRef, rightRef)

  const handleResize = useCallback((delta: number) => {
    setLeftWidth((prev) => Math.max(20, Math.min(80, prev + (delta / window.innerWidth) * 100)))
  }, [])

  return (
    <div className="dual-pane-view">
      <div className="dual-pane-left" ref={leftRef} style={{ width: `${leftWidth}%` }} onScroll={syncScroll}>
        <ScriptOnlyView sections={sections} onUpdateSection={onUpdateSection} />
      </div>
      <ResizeDivider onResize={handleResize} />
      <div className="dual-pane-right" ref={rightRef} style={{ width: `${100 - leftWidth}%` }}>
        <TimelineMinimap />
      </div>
    </div>
  )
}
