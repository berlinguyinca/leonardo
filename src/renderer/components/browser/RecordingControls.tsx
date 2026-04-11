import { useState, useEffect, useRef, useCallback } from 'react'
import { useRecordingStore } from '../../stores/recording-store'
import { useUIStore } from '../../stores/ui-store'
import { useLibraryStore } from '../../stores/library-store'
import { useTimelineStore } from '../../stores/timeline-store'
import { useProjectStore } from '../../stores/project-store'
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

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

  const stopMediaRecorder = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(new Blob([], { type: 'video/webm' }))
        return
      }
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop())
        resolve(new Blob(chunksRef.current, { type: 'video/webm' }))
      }
      mediaRecorderRef.current = null
      recorder.stop()
    })
  }, [])

  useEffect(() => {
    return () => {
      stopTimer()
      // Stop media recorder if component unmounts during recording
      void stopMediaRecorder()
    }
  }, [stopTimer, stopMediaRecorder])

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
    await window.leonardo.recording.start({ webviewId: webContentsId })

    // Start screen capture via MediaRecorder
    try {
      chunksRef.current = []
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 } as MediaTrackConstraints,
      })
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start(1000) // collect a chunk every second
      mediaRecorderRef.current = recorder
    } catch (err) {
      // If screen capture fails (e.g. user denied), continue recording without video
      console.warn('[RecordingControls] Screen capture failed:', err)
    }
  }, [status, setStatus, setRecordingDuration, startTimer, stopTimer, collapseAllPanels, restorePanelState, webviewRef])

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
    try {
      // Stop both the recorder and the IPC session in parallel
      const [blob, result] = await Promise.all([
        stopMediaRecorder(),
        window.leonardo.recording.stop(),
      ])

      if (!result.success || !result.recordingId || !result.outputDir) return

      // Skip video pipeline if no video was captured (e.g. screen share denied)
      if (blob.size === 0) return

      // Save the WebM blob to disk
      const buffer = await blob.arrayBuffer()
      const saveResult = await window.leonardo.recording.saveBlob({
        outputDir: result.outputDir,
        buffer,
      })

      if (!saveResult.success) {
        console.warn('[RecordingControls] Failed to save blob:', saveResult.error)
        return
      }

      // Convert WebM → MP4 and persist .events.json
      const convertResult = await window.leonardo.recording.convert({
        recordingId: result.recordingId,
        webmPath: saveResult.webmPath,
        outputDir: result.outputDir,
        projectId: activeProjectId ?? '',
      })

      if (convertResult.success && convertResult.videoPath) {
        const currentClipCount = useLibraryStore.getState().clips.length
        const clip: Clip = {
          id: result.recordingId,
          projectId: activeProjectId ?? '',
          filePath: convertResult.videoPath,
          duration: result.duration ?? recordingDuration,
          url: currentUrl,
          resolution: { width: targetResolution.width, height: targetResolution.height },
          createdAt: new Date().toISOString(),
          label: `Recording ${currentClipCount + 1}`,
        }
        await addClip(clip)
        setHighlightedClip(clip.id)
        setPendingClip(clip)
      }
    } finally {
      restorePanelState()
      setStatus('idle')
    }
  }, [
    stopTimer, setStatus, stopMediaRecorder, activeProjectId, recordingDuration,
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
              setWorkspacePreset('editing')
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
