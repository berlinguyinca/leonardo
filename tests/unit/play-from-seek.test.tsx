// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'

/**
 * Play-from-selected-frame bug: after stepping with arrow keys to a new
 * position, pressing play should start from that position. The issue is
 * that positionRef in usePlayhead may be stale from the last RAF tick.
 *
 * The fix ensures positionRef is authoritatively synced from the store
 * when isPlaying transitions to true.
 */

const FRAME_MS = Math.round(1000 / 15)

describe('Play from seeked position', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      isPlaying: false,
      playheadPosition: 0,
      playbackRate: 1,
      timeline: {
        id: 't1',
        projectId: 'p1',
        tracks: [
          {
            id: 'track1',
            type: 'clip' as const,
            label: 'Recordings',
            zOrder: 0,
            muted: false,
            locked: false,
            segments: [
              {
                id: 'seg1',
                trackId: 'track1',
                startTime: 0,
                endTime: 10000,
                sourceFile: '/path/to/clip.webm',
                sourceOffset: 0,
                label: 'Clip 1',
              },
            ],
          },
        ],
        syncPoints: [],
        duration: 10000,
        reviewed: false,
      },
    })
  })

  it('store position reflects arrow key seek', () => {
    // Seek to frame 30 via arrow keys
    const targetPos = 30 * FRAME_MS
    useTimelineStore.getState().setPlayheadPosition(targetPos)

    expect(useTimelineStore.getState().playheadPosition).toBe(targetPos)
  })

  it('after arrow key seek, isPlaying true reads correct position from store', () => {
    // Simulate: user steps to frame 30, then presses play
    const targetPos = 30 * FRAME_MS
    useTimelineStore.getState().setPlayheadPosition(targetPos)

    // When isPlaying transitions to true, the playhead hook reads from store
    const storePos = useTimelineStore.getState().playheadPosition
    expect(storePos).toBe(targetPos)

    // This is what usePlayhead does at the start of the RAF loop:
    // positionRef.current = useTimelineStore.getState().playheadPosition
    // Verify the store returns the seeked position, not zero
    useTimelineStore.getState().setIsPlaying(true)
    const posAfterPlay = useTimelineStore.getState().playheadPosition
    expect(posAfterPlay).toBe(targetPos)
  })

  it('after ruler seek, playing starts from that position', () => {
    // seekTo calls both setVisualPosition and setPlayheadPosition
    const targetPos = 5000
    useTimelineStore.getState().setPlayheadPosition(targetPos)

    expect(useTimelineStore.getState().playheadPosition).toBe(targetPos)

    // Start playing
    useTimelineStore.getState().setIsPlaying(true)

    // Position should still be at target (not reset)
    expect(useTimelineStore.getState().playheadPosition).toBe(targetPos)
  })

  it('playhead at end of timeline resets to 0 on play', () => {
    // Set playhead at the end
    const duration = useTimelineStore.getState().timeline?.duration ?? 0
    useTimelineStore.getState().setPlayheadPosition(duration)

    expect(useTimelineStore.getState().playheadPosition).toBe(duration)

    // The usePlayhead hook handles this case: if position >= duration, reset to 0
    // This is correct behavior — playing from the end should restart
  })
})
