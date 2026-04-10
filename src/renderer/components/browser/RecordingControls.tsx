import { useState, useEffect, useRef, useCallback } from 'react'
import { useRecordingStore } from '../../stores/recording-store'
import { useUIStore } from '../../stores/ui-store'
import { useLibraryStore } from '../../stores/library-store'
import type { Clip } from '@shared/types/events'

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

  const collapseAllPanels = useUIStore((s) => s.collapseAllPanels)
  const restorePanelState = useUIStore((s) => s.restorePanelState)
  const currentUrl = useRecordingStore((s) => s.currentUrl)
  const targetResolution = useRecordingStore((s) => s.targetResolution)
  const addClip = useLibraryStore((s) => s.addClip)
  const setHighlightedClip = useLibraryStore((s) => s.setHighlightedClip)
  const clipCount = useLibraryStore((s) => s.clips.length)

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
    collapseAllPanels()

    // Signal main process to begin capture
    await window.leonardo.recording.start({
      webviewId: webviewRef.current?.getWebContentsId() ?? -1,
    })
  }, [setStatus, setRecordingDuration, startTimer, collapseAllPanels, webviewRef])

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

    const result = await window.leonardo.recording.stop()

    if (result.success && result.recordingId) {
      const clip: Clip = {
        id: result.recordingId,
        projectId: '',
        filePath: result.outputDir ? `${result.outputDir}/recording.webm` : '',
        duration: result.duration ?? recordingDuration,
        url: currentUrl,
        resolution: { width: targetResolution.width, height: targetResolution.height },
        createdAt: new Date().toISOString(),
        label: `Recording ${clipCount + 1}`,
      }
      addClip(clip)
      setHighlightedClip(clip.id)
    }

    restorePanelState()
    setStatus('idle')
  }, [setStatus, stopTimer, recordingDuration, currentUrl, targetResolution, clipCount, addClip, setHighlightedClip, restorePanelState])

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
