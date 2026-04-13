import { useRef, useEffect, useCallback, useState } from 'react'

interface VideoPlayerProps {
  src: string
  currentTime: number
  playing: boolean
  playbackRate: number
}

export function VideoPlayer({ src, currentTime, playing, playbackRate }: VideoPlayerProps): React.ReactNode {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Track the src that was actually loaded — guards against stale ready state
  // when src changes before new loadeddata fires
  const loadedSrcRef = useRef<string>('')

  // Keep prop values in refs so the loadeddata handler always has current values
  const currentTimeRef = useRef(currentTime)
  currentTimeRef.current = currentTime
  const playingRef = useRef(playing)
  playingRef.current = playing
  const playbackRateRef = useRef(playbackRate)
  playbackRateRef.current = playbackRate

  // When src changes, video reloads — mark not ready, clear any previous error
  useEffect(() => {
    setError(null)
    setReady(false)
  }, [src])

  const handleError = useCallback(() => {
    const video = videoRef.current
    const msg = video?.error?.message || 'Failed to load video'
    console.error('[VideoPlayer] load error:', msg)
    setError(msg)
  }, [])

  // Apply pending play/seek when video data has loaded
  const handleLoadedData = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    // Record which src (prop value) just finished loading so the play/pause
    // effect can distinguish "ready for current src" from "ready for a stale src"
    loadedSrcRef.current = src
    setReady(true)

    video.playbackRate = playbackRateRef.current

    // Apply pending seek position
    const timeSec = currentTimeRef.current / 1000
    if (Math.abs(video.currentTime - timeSec) > 0.05) {
      video.currentTime = timeSec
    }
    // Play is handled by the play/pause effect which re-runs when ready flips to true
  }, [src])

  // Sync play/pause state — only when video is ready for the current src
  useEffect(() => {
    const video = videoRef.current
    if (!video || !ready || loadedSrcRef.current !== src) return
    if (playing) {
      video.play().catch((e) => console.warn('[VideoPlayer] play failed:', e))
    } else {
      video.pause()
    }
  }, [playing, src, ready])

  // Sync playback rate
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = playbackRate
  }, [playbackRate])

  // Sync seek position — only when paused and video is ready for the current src.
  // No debounce: arrow key frame stepping needs every seek to land immediately.
  useEffect(() => {
    const video = videoRef.current
    if (!video || playing || !ready || loadedSrcRef.current !== src) return
    const timeSec = currentTime / 1000
    if (Math.abs(video.currentTime - timeSec) > 0.05) {
      video.currentTime = timeSec
    }
  }, [currentTime, playing, ready])

  if (error) {
    return <div className="playback-video playback-error">{error}</div>
  }

  return (
    <video
      ref={videoRef}
      className="playback-video"
      src={src}
      preload="auto"
      onLoadedData={handleLoadedData}
      onError={handleError}
    />
  )
}
