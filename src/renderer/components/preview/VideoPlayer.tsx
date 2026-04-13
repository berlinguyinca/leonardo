import { useRef, useEffect, useCallback } from 'react'

interface VideoPlayerProps {
  src: string
  currentTime: number
  playing: boolean
  playbackRate: number
}

export function VideoPlayer({ src, currentTime, playing, playbackRate }: VideoPlayerProps): React.ReactNode {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readyRef = useRef(false)

  // Keep prop values in refs so the loadeddata handler always has current values
  const currentTimeRef = useRef(currentTime)
  currentTimeRef.current = currentTime
  const playingRef = useRef(playing)
  playingRef.current = playing
  const playbackRateRef = useRef(playbackRate)
  playbackRateRef.current = playbackRate

  // When src changes, video reloads — mark not ready
  useEffect(() => {
    readyRef.current = false
  }, [src])

  // Apply pending play/seek when video data has loaded
  const handleLoadedData = useCallback(() => {
    readyRef.current = true
    const video = videoRef.current
    if (!video) return

    video.playbackRate = playbackRateRef.current

    // Apply pending seek position
    const timeSec = currentTimeRef.current / 1000
    if (Math.abs(video.currentTime - timeSec) > 0.05) {
      video.currentTime = timeSec
    }

    // Apply pending play
    if (playingRef.current) {
      video.play().catch((e) => console.warn('[VideoPlayer] play failed on loadeddata:', e))
    }
  }, [])

  // Sync play/pause state — only when video is ready
  useEffect(() => {
    const video = videoRef.current
    if (!video || !readyRef.current) return
    if (playing) {
      video.play().catch((e) => console.warn('[VideoPlayer] play failed:', e))
    } else {
      video.pause()
    }
  }, [playing, src])

  // Sync playback rate
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = playbackRate
  }, [playbackRate])

  // Sync seek position — only when paused and video is ready.
  // No debounce: arrow key frame stepping needs every seek to land immediately.
  useEffect(() => {
    const video = videoRef.current
    if (!video || playing || !readyRef.current) return
    const timeSec = currentTime / 1000
    if (Math.abs(video.currentTime - timeSec) > 0.05) {
      video.currentTime = timeSec
    }
  }, [currentTime, playing])

  return (
    <video
      ref={videoRef}
      className="playback-video"
      src={src}
      preload="auto"
      onLoadedData={handleLoadedData}
    />
  )
}
