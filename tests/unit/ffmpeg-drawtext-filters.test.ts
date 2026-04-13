import { describe, it, expect } from 'vitest'
import { buildDrawtextFilters } from '@main/utils/ffmpeg-builder'
import type { Segment } from '@shared/types'
import type { OverlaySegmentMetadata } from '@shared/types'

function makeOverlaySegment(overrides: Partial<Segment> & { meta?: Partial<OverlaySegmentMetadata['element']> }): Segment {
  const { meta, ...rest } = overrides
  const element: OverlaySegmentMetadata['element'] = {
    id: 'el-1',
    overlayType: 'title',
    text: 'Hello World',
    x: 50,
    y: 50,
    width: 60,
    height: 20,
    fontFamily: 'Inter',
    fontSize: 32,
    color: '#ffffff',
    backgroundColor: '#000000',
    backgroundOpacity: 0,
    transitionIn: 'none',
    transitionOut: 'none',
    transitionDuration: 500,
    ...meta,
  }
  const metadata: OverlaySegmentMetadata = { element }
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 1000,
    endTime: 5000,
    sourceFile: '',
    sourceOffset: 0,
    label: 'Overlay',
    metadata: JSON.stringify(metadata),
    ...rest,
  }
}

describe('buildDrawtextFilters', () => {
  it('returns empty array for no segments', () => {
    expect(buildDrawtextFilters([], 1920, 1080)).toEqual([])
  })

  it('returns empty array for segment with no metadata', () => {
    const seg: Segment = {
      id: 'seg-1',
      trackId: 'track-1',
      startTime: 0,
      endTime: 3000,
      sourceFile: '',
      sourceOffset: 0,
      label: 'plain',
    }
    expect(buildDrawtextFilters([seg], 1920, 1080)).toEqual([])
  })

  it('returns empty array for segment with non-overlay metadata', () => {
    const seg: Segment = {
      id: 'seg-1',
      trackId: 'track-1',
      startTime: 0,
      endTime: 3000,
      sourceFile: '',
      sourceOffset: 0,
      label: 'plain',
      metadata: JSON.stringify({ someOtherKey: true }),
    }
    expect(buildDrawtextFilters([seg], 1920, 1080)).toEqual([])
  })

  it('generates a drawtext filter for a basic text overlay', () => {
    const seg = makeOverlaySegment({})
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    expect(filters).toHaveLength(1)
    expect(filters[0]).toMatch(/^drawtext=/)
    expect(filters[0]).toContain("text='Hello World'")
    expect(filters[0]).toContain('fontsize=32')
    expect(filters[0]).toContain('fontcolor=#ffffff')
    expect(filters[0]).toContain("font='Inter'")
  })

  it('converts percentage position to pixel coordinates', () => {
    // x=25%, y=75% of 1920x1080 → x=480, y=810
    const seg = makeOverlaySegment({ meta: { x: 25, y: 75 } })
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    expect(filters[0]).toContain('x=480')
    expect(filters[0]).toContain('y=810')
  })

  it('rounds pixel coordinate calculation', () => {
    // x=33.33% of 1920 = 640.0 (rounds to 640)
    const seg = makeOverlaySegment({ meta: { x: 33.333, y: 0 } })
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    expect(filters[0]).toContain('x=640')
  })

  it('includes correct enable time range expression', () => {
    // startTime=2000ms → 2.000s, endTime=7500ms → 7.500s
    const seg = makeOverlaySegment({ startTime: 2000, endTime: 7500 })
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    expect(filters[0]).toContain("enable='between(t,2.000,7.500)'")
  })

  it('escapes colons in text', () => {
    const seg = makeOverlaySegment({ meta: { text: 'Time: 10:30' } })
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    // Colons should be escaped as \\:
    expect(filters[0]).toContain('Time\\\\:')
  })

  it('escapes single quotes in text', () => {
    const seg = makeOverlaySegment({ meta: { text: "It's alive" } })
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    // Single quotes should be escaped for FFmpeg shell quoting
    expect(filters[0]).toContain("It'\\\\\\''s alive")
  })

  it('adds box parameters when backgroundOpacity > 0', () => {
    const seg = makeOverlaySegment({
      meta: { backgroundColor: '#000000', backgroundOpacity: 0.5 },
    })
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    expect(filters[0]).toContain('box=1')
    expect(filters[0]).toContain('boxcolor=#000000@0x80')
    expect(filters[0]).toContain('boxborderw=10')
  })

  it('does not add box when backgroundOpacity is 0', () => {
    const seg = makeOverlaySegment({
      meta: { backgroundColor: '#000000', backgroundOpacity: 0 },
    })
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    expect(filters[0]).not.toContain('box=1')
  })

  it('converts backgroundOpacity to hex correctly for full opacity', () => {
    const seg = makeOverlaySegment({
      meta: { backgroundColor: '#ff0000', backgroundOpacity: 1 },
    })
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    // 1 * 255 = 255 = 0xff
    expect(filters[0]).toContain('boxcolor=#ff0000@0xff')
  })

  it('adds alpha fade-in expression for fade transitionIn', () => {
    const seg = makeOverlaySegment({
      startTime: 2000,
      endTime: 7000,
      meta: { transitionIn: 'fade', transitionDuration: 500 },
    })
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    expect(filters[0]).toContain('alpha=')
    expect(filters[0]).toContain('if(lt(t-2.000,0.500)')
  })

  it('does not add alpha expression for non-fade transition', () => {
    const seg = makeOverlaySegment({
      meta: { transitionIn: 'slide-left', transitionDuration: 500 },
    })
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    expect(filters[0]).not.toContain('alpha=')
  })

  it('does not add alpha expression when transitionDuration is 0', () => {
    const seg = makeOverlaySegment({
      meta: { transitionIn: 'fade', transitionDuration: 0 },
    })
    const filters = buildDrawtextFilters([seg], 1920, 1080)

    expect(filters[0]).not.toContain('alpha=')
  })

  it('handles multiple overlay segments producing multiple filters', () => {
    const seg1 = makeOverlaySegment({ id: 'seg-1', meta: { text: 'First' } })
    const seg2 = makeOverlaySegment({ id: 'seg-2', meta: { text: 'Second' }, startTime: 6000, endTime: 10000 })
    const filters = buildDrawtextFilters([seg1, seg2], 1920, 1080)

    expect(filters).toHaveLength(2)
    expect(filters[0]).toContain("text='First'")
    expect(filters[1]).toContain("text='Second'")
  })

  it('skips segments with invalid JSON metadata', () => {
    const seg: Segment = {
      id: 'seg-1',
      trackId: 'track-1',
      startTime: 0,
      endTime: 3000,
      sourceFile: '',
      sourceOffset: 0,
      label: 'bad',
      metadata: '{not valid json',
    }
    expect(buildDrawtextFilters([seg], 1920, 1080)).toEqual([])
  })
})
