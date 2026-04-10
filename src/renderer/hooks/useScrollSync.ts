import { useCallback, useRef } from 'react'

export function useScrollSync(
  sourceRef: React.RefObject<HTMLElement | null>,
  targetRef: React.RefObject<HTMLElement | null>,
) {
  const isScrolling = useRef(false)

  const syncScroll = useCallback(() => {
    if (isScrolling.current) return
    if (!sourceRef.current || !targetRef.current) return

    isScrolling.current = true
    const sourceMax = sourceRef.current.scrollHeight - sourceRef.current.clientHeight
    const targetMax = targetRef.current.scrollHeight - targetRef.current.clientHeight
    if (sourceMax > 0 && targetMax > 0) {
      const ratio = sourceRef.current.scrollTop / sourceMax
      targetRef.current.scrollTop = ratio * targetMax
    }
    requestAnimationFrame(() => { isScrolling.current = false })
  }, [sourceRef, targetRef])

  return { syncScroll }
}
