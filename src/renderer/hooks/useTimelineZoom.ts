import { useCallback, useRef } from 'react'
import { useTimelineStore } from '../stores/timeline-store'
import { TIMELINE_MIN_ZOOM, TIMELINE_MAX_ZOOM } from '@shared/constants'
import { pixelToTime, timeToPixel } from '../components/timeline/timeline-utils'

export function computeZoomScrollOffset(
  cursorPx: number,
  currentScroll: number,
  oldZoom: number,
  newZoom: number,
): number {
  const timeAtCursor = pixelToTime(cursorPx, oldZoom, currentScroll)
  const newPxAtTime = timeToPixel(timeAtCursor, newZoom, 0)
  return Math.max(0, newPxAtTime - cursorPx)
}

export function useTimelineZoom(scrollRef: React.RefObject<HTMLDivElement | null>) {
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const setZoomLevel = useTimelineStore((s) => s.setZoomLevel)
  const scrollOffsetRef = useRef(0)

  const zoom = useCallback(
    (direction: 'in' | 'out', cursorPx?: number) => {
      const oldZoom = useTimelineStore.getState().zoomLevel
      const factor = direction === 'in' ? 1.2 : 1 / 1.2
      const newZoom = Math.max(TIMELINE_MIN_ZOOM, Math.min(TIMELINE_MAX_ZOOM, oldZoom * factor))

      if (cursorPx !== undefined && scrollRef.current) {
        const currentScroll = scrollRef.current.scrollLeft
        const newScroll = computeZoomScrollOffset(cursorPx, currentScroll, oldZoom, newZoom)
        scrollOffsetRef.current = newScroll
        scrollRef.current.scrollLeft = newScroll
      }

      setZoomLevel(newZoom)
    },
    [setZoomLevel, scrollRef],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const cursorPx = e.clientX - rect.left
      zoom(e.deltaY < 0 ? 'in' : 'out', cursorPx)
    },
    [zoom],
  )

  return { zoomLevel, zoom, handleWheel, scrollOffsetRef }
}
