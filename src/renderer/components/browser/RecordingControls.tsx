import { useState, useEffect, useRef, useCallback } from 'react'
import { useRecordingStore } from '../../stores/recording-store'
import { useUIStore } from '../../stores/ui-store'
import { useLibraryStore } from '../../stores/library-store'
import { useTimelineStore } from '../../stores/timeline-store'
import { useProjectStore } from '../../stores/project-store'
import { useToastStore } from '../../stores/toast-store'
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
  const setEditorView = useUIStore((s) => s.setEditorView)
  const setTimelineCollapsed = useUIStore((s) => s.setTimelineCollapsed)
  const setWorkspacePreset = useUIStore((s) => s.setWorkspacePreset)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const currentUrl = useRecordingStore((s) => s.currentUrl)
  const targetResolution = useRecordingStore((s) => s.targetResolution)
  const addClip = useLibraryStore((s) => s.addClip)
  const setHighlightedClip = useLibraryStore((s) => s.setHighlightedClip)
  const addClipToTimeline = useTimelineStore((s) => s.addClipToTimeline)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const [pausedDuration, setPausedDuration] = useState(0)
  const [pendingClip, setPendingClip] = useState<Clip | null>(null)

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
    return () => { stopTimer() }
  }, [stopTimer])

  useEffect(() => {
    if (!pendingClip) return
    const timer = setTimeout(() => setPendingClip(null), 6000)
    return () => clearTimeout(timer)
  }, [pendingClip])

  const handleStart = useCallback(async () => {
    if (status !== 'idle') return
    setStatus('recording')
    setRecordingDuration(0)
    setPausedDuration(0)
    startTimer()
    collapseAllPanels()

    const webContentsId = webviewRef.current?.getWebContentsId()
    if (webContentsId == null) {
      setStatus('idle')
      restorePanelState()
      stopTimer()
      return
    }
    try {
      const result = await window.leonardo.recording.start({ webviewId: webContentsId, projectId: activeProjectId ?? undefined })
      if (!result.success) {
        throw new Error(result.error ?? 'Recording failed to start')
      }
      if (result.warning) {
        useToastStore.getState().addToast(result.warning, 'warning')
      }
    } catch (err) {
      setStatus('idle')
      restorePanelState()
      stopTimer()
      const msg = err instanceof Error ? err.message : 'Unknown error'
      useToastStore.getState().addToast(`Recording failed: ${msg}`, 'error')
    }
  }, [status, setStatus, setRecordingDuration, startTimer, stopTimer, collapseAllPanels, restorePanelState, webviewRef, activeProjectId])

  const handlePause = useCallback(async () => {
    setStatus('paused')
    stopTimer()
    setPausedDuration(recordingDuration)
    try {
      await window.leonardo.recording.pause()
    } catch {
      useToastStore.getState().addToast('Failed to pause recording', 'warning')
    }
  }, [setStatus, stopTimer, recordingDuration])

  const handleResume = useCallback(async () => {
    setStatus('recording')
    startTimer()
    try {
      await window.leonardo.recording.resume()
    } catch {
      useToastStore.getState().addToast('Failed to resume recording', 'warning')
    }
  }, [setStatus, startTimer])

  const handleStop = useCallback(async () => {
    stopTimer()
    setStatus('processing')
    try {
      const result = await window.leonardo.recording.stop()
      if (!result.success || !result.recordingId || !result.videoPath) {
        useToastStore.getState().addToast(
          `Recording failed: ${result.error ?? 'No video was captured'}`,
          'error',
        )
        return
      }

      const currentClipCount = useLibraryStore.getState().clips.length
      const clip: Clip = {
        id: result.recordingId,
        projectId: activeProjectId ?? '',
        filePath: result.videoPath,
        duration: result.duration ?? recordingDuration,
        url: currentUrl,
        resolution: { width: targetResolution.width, height: targetResolution.height },
        createdAt: new Date().toISOString(),
        label: `Recording ${currentClipCount + 1}`,
      }
      await addClip(clip)
      setHighlightedClip(clip.id)
      setPendingClip(clip)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      useToastStore.getState().addToast(`Recording stop failed: ${msg}`, 'error')
    } finally {
      restorePanelState()
      setStatus('idle')
    }
  }, [
    stopTimer, setStatus, activeProjectId, recordingDuration,
    currentUrl, targetResolution, addClip, setHighlightedClip, restorePanelState,
  ])

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

      {pendingClip && (
        <div className="post-recording-prompt">
          <span>Clip added to library.</span>
          <button
            onClick={() => {
              addClipToTimeline(pendingClip)
              setWorkspacePreset('script')
              setEditorView('inline')
              setTimelineCollapsed(false)
              setPendingClip(null)
            }}
          >
            Edit Now
          </button>
          <button onClick={() => setPendingClip(null)}>Later</button>
        </div>
      )}
    </div>
  )
}
