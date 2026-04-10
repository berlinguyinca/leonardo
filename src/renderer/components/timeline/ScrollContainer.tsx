import { forwardRef, useCallback, type ReactNode } from 'react'

interface ScrollContainerProps {
  children: ReactNode
  totalWidth: number
  onScroll: (scrollLeft: number) => void
  onWheel: (e: React.WheelEvent) => void
}

export const ScrollContainer = forwardRef<HTMLDivElement, ScrollContainerProps>(
  function ScrollContainer({ children, totalWidth, onScroll, onWheel }, ref) {
    const handleScroll = useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        onScroll((e.currentTarget as HTMLDivElement).scrollLeft)
      },
      [onScroll],
    )

    return (
      <div
        className="timeline-scroll-container"
        ref={ref}
        onScroll={handleScroll}
        onWheel={onWheel}
      >
        <div className="timeline-scroll-content" style={{ width: totalWidth }}>
          {children}
        </div>
      </div>
    )
  },
)
