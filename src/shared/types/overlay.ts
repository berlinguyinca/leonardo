export type OverlayType = 'intro' | 'exit' | 'title' | 'section'
export type TransitionAnimation = 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'typewriter' | 'none'

export interface TextOverlayElement {
  id: string
  overlayType: OverlayType
  text: string
  x: number           // percentage 0-100
  y: number           // percentage 0-100
  width: number       // percentage 0-100
  height: number      // percentage 0-100
  fontFamily: string
  fontSize: number    // px
  color: string       // hex
  backgroundColor: string  // hex
  backgroundOpacity: number // 0-1
  transitionIn: TransitionAnimation
  transitionOut: TransitionAnimation
  transitionDuration: number // ms
}

export interface OverlaySegmentMetadata {
  element: TextOverlayElement
}

export function parseOverlayMetadata(segment: { metadata?: string }): OverlaySegmentMetadata | null {
  if (!segment.metadata) return null
  try {
    const parsed = JSON.parse(segment.metadata)
    if (!parsed?.element?.id || !parsed?.element?.overlayType) return null
    return parsed as OverlaySegmentMetadata
  } catch {
    return null
  }
}

export function defaultOverlayMetadata(overlayType: OverlayType): OverlaySegmentMetadata {
  return {
    element: {
      id: crypto.randomUUID(),
      overlayType,
      text: overlayType === 'intro' ? 'Introduction' :
            overlayType === 'exit' ? 'Thank You' :
            overlayType === 'title' ? 'Title' : 'Section',
      x: 50, y: 50, width: 60, height: 20,
      fontFamily: 'Inter',
      fontSize: 32,
      color: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0.7,
      transitionIn: 'fade',
      transitionOut: 'fade',
      transitionDuration: 500,
    }
  }
}
