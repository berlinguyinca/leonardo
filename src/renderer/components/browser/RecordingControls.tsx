import { useState, useEffect, useRef, useCallback } from 'react'
import { useRecordingStore } from '../../stores/recording-store'

interface RecordingControlsProps {
  webviewRef: React.RefObject<Electron.WebviewTag | null>
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`
}

export function RecordingControls({ webviewRef }: RecordingControlsProps): React.ReactNode {
  const status = useRecordingStore((s) => s.status)
  const setStatus = useRecordingStore((s) => s.setStatus)
  const recordingDuration = useRecordingStore((s) => s.recordingDuration)
  const setRecordingDuration = useRecordingStore((s) => s.setRecordingDuration)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const [pausedDuration, setPausedDuration] = useState(0)

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - pausedDuration
    timerRef.current = setInterval(() => {
      setRecordingDuration(Date.now() - startTimeRef.current)
    }, 100)
  }, [pausedDuration, setRecordingDuration])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopTimer()
  }, [stopTimer])

  const handleStart = useCallback(async () => {
    setStatus('recording')
    setRecordingDuration(0)
    setPausedDuration(0)
    startTimer()

    // Signal main process to begin capture
    await window.leonardo.recording.start({
      webviewId: webviewRef.current?.getWebContentsId() ?? -1,
    })
  }, [setStatus, setRecordingDuration, startTimer, webviewRef])

  const handlePause = useCallback(() => {
    setStatus('paused')
    stopTimer()
    setPausedDuration(recordingDuration)

    window.leonardo.recording.pause()
  }, [setStatus, stopTimer, recordingDuration])

  const handleResume = useCallback(() => {
    setStatus('recording')
    startTimer()

    window.leonardo.recording.resume()
  }, [setStatus, startTimer])

  const handleStop = useCallback(async () => {
    stopTimer()
    setStatus('processing')

    await window.leonardo.recording.stop()
    setStatus('idle')
  }, [setStatus, stopTimer])

  const isRecording = status === 'recording'
  const isPaused = status === 'paused'
  const isProcessing = status === 'processing'
  const isIdle = status === 'idle'

  return (
    <div className="recording-controls">
      <div className="recording-timer" data-active={isRecording || isPaused}>
        {isRecording && <span className="recording-indicator" />}
        {formatDuration(recordingDuration)}
      </div>

      <div className="recording-buttons">
        {isIdle && (
          <button className="rec-btn rec-btn-start" onClick={handleStart}>
            Record
          </button>
        )}
        {isRecording && (
          <>
            <button className="rec-btn rec-btn-pause" onClick={handlePause}>
              Pause
            </button>
            <button className="rec-btn rec-btn-stop" onClick={handleStop}>
              Stop
            </button>
          </>
        )}
        {isPaused && (
          <>
            <button className="rec-btn rec-btn-resume" onClick={handleResume}>
              Resume
            </button>
            <button className="rec-btn rec-btn-stop" onClick={handleStop}>
              Stop
            </button>
          </>
        )}
        {isProcessing && (
          <span className="processing-label">Processing...</span>
        )}
      </div>
    </div>
  )
}
