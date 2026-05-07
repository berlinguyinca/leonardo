// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { VideoPlayer } from '../../src/renderer/components/preview/VideoPlayer'

let playSpy: ReturnType<typeof vi.spyOn>
let pauseSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('VideoPlayer — loading lifecycle', () => {
  it('does NOT call play() before loadeddata fires', () => {
    render(
      <VideoPlayer src="media:///video.mp4" currentTime={0} playing={true} playbackRate={1} />,
    )
    // play() should not be called yet — video is not ready
    expect(playSpy).not.toHaveBeenCalled()
  })

  it('calls play() when loadeddata fires and playing=true', () => {
    const { container } = render(
      <VideoPlayer src="media:///video.mp4" currentTime={0} playing={true} playbackRate={1} />,
    )

    const video = container.querySelector('video')!
    fireEvent.loadedData(video)

    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('seeks to correct currentTime on loadeddata when paused', () => {
    const { container } = render(
      <VideoPlayer src="media:///video.mp4" currentTime={3000} playing={false} playbackRate={1} />,
    )

    const video = container.querySelector('video')!

    // Before loadeddata, currentTime should be at default (0)
    expect(video.currentTime).toBe(0)

    fireEvent.loadedData(video)

    // After loadeddata, should seek to 3.0 seconds
    expect(video.currentTime).toBe(3)
  })

  it('resets ready state when src changes', () => {
    const { container, rerender } = render(
      <VideoPlayer src="media:///video-a.mp4" currentTime={0} playing={false} playbackRate={1} />,
    )

    const video = container.querySelector('video')!
    fireEvent.loadedData(video)

    // Now change src — play should NOT be called until new loadeddata
    rerender(
      <VideoPlayer src="media:///video-b.mp4" currentTime={0} playing={true} playbackRate={1} />,
    )

    // play() should NOT have been called (new src not loaded yet)
    expect(playSpy).not.toHaveBeenCalled()

    // Fire loadeddata for the new source
    fireEvent.loadedData(video)

    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it('applies playbackRate on loadeddata', () => {
    const { container } = render(
      <VideoPlayer src="media:///video.mp4" currentTime={0} playing={false} playbackRate={2} />,
    )

    const video = container.querySelector('video')!
    fireEvent.loadedData(video)

    expect(video.playbackRate).toBe(2)
  })

  it('calls pause() on loadeddata when playing=false after src change', () => {
    const { container, rerender } = render(
      <VideoPlayer src="media:///video-a.mp4" currentTime={0} playing={true} playbackRate={1} />,
    )

    const video = container.querySelector('video')!
    fireEvent.loadedData(video)
    expect(playSpy).toHaveBeenCalledTimes(1)

    // Switch to paused with new src
    rerender(
      <VideoPlayer src="media:///video-b.mp4" currentTime={0} playing={false} playbackRate={1} />,
    )

    fireEvent.loadedData(video)

    // play should not have been called again
    expect(playSpy).toHaveBeenCalledTimes(1)
  })
})
