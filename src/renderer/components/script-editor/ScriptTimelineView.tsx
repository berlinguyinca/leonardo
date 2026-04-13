import { useCallback, useEffect, useRef, useState } from 'react'
import { PlaybackPanel } from '../preview/PlaybackPanel'
import { Timeline } from '../timeline/Timeline'
import { GenerationLog } from './GenerationLog'
import { useTimelineStore } from '../../stores/timeline-store'
import { useLibraryStore } from '../../stores/library-store'
import { useScriptStore } from '../../stores/script-store'
import { useProjectStore } from '../../stores/project-store'
import type { VoiceProfile } from '@shared/types/tts'
import type { TTSEngineType } from '@shared/types/tts'

export function ScriptTimelineView(): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const [generating, setGenerating] = useState(false)
  const [voices, setVoices] = useState<VoiceProfile[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>('')
  const [generatingTTS, setGeneratingTTS] = useState(false)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const generationLog = useScriptStore((s) => s.generationLog)
  const setGenerationLog = useScriptStore((s) => s.setGenerationLog)

  useEffect(() => {
    if (!window.leonardo?.tts?.listVoices) return
    window.leonardo.tts.listVoices('edge-tts' as TTSEngineType).then(setVoices).catch(() => {})
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientY - containerRect.top) / containerRect.height) * 100
      const clamped = Math.max(20, Math.min(70, pct))

      const top = containerRef.current.querySelector('.script-preview-section') as HTMLElement | null
      if (top) top.style.flex = `0 0 ${clamped}%`
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handleGenerateScript = async () => {
    if (!activeProjectId || !window.leonardo?.ai) return
    setGenerating(true)
    try {
      const timeline = useTimelineStore.getState().timeline
      const clips = useLibraryStore.getState().clips
      if (!timeline) return

      const firstClipSegment = timeline.tracks
        .filter((t) => t.type === 'clip' || t.type === 'recording')
        .flatMap((t) => t.segments)[0]
      if (!firstClipSegment) return

      const clip = clips.find((c) => c.filePath === firstClipSegment.sourceFile)
      if (!clip) return

      const result = await window.leonardo.ai.generateScript({
        config: { provider: 'claude', mode: 'cloud' },
        prompt: 'Generate a tutorial narration script for this recording.',
        context: {
          domEvents: [],
          recordingDuration: clip.duration,
          url: clip.url,
          userPrompt: 'Generate a tutorial narration script for this recording.',
        },
        projectId: activeProjectId,
        clipId: clip.id,
      })

      if (result.success && result.script && result.script.sections.length > 0) {
        useScriptStore.getState().setSections(result.script.sections)
        useScriptStore.getState().setClipScript(clip.id, result.script.sections)

        if (result.script.sections.length > 1) {
          useTimelineStore.getState().splitClipBySections(firstClipSegment.id, result.script.sections)
        }
      }
      if (result.generationLog) {
        setGenerationLog(result.generationLog)
      }
    } catch (err) {
      console.error('[ScriptTimelineView] Script generation failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async (customPrompt: string) => {
    if (!activeProjectId || !window.leonardo?.ai) return
    setGenerating(true)
    try {
      const timeline = useTimelineStore.getState().timeline
      const clips = useLibraryStore.getState().clips
      if (!timeline) return

      const firstClipSegment = timeline.tracks
        .filter((t) => t.type === 'clip' || t.type === 'recording')
        .flatMap((t) => t.segments)[0]
      if (!firstClipSegment) return

      const clip = clips.find((c) => c.filePath === firstClipSegment.sourceFile)
      if (!clip) return

      const result = await window.leonardo.ai.generateScript({
        config: { provider: 'claude', mode: 'cloud' },
        prompt: customPrompt,
        context: {
          domEvents: [],
          recordingDuration: clip.duration,
          url: clip.url,
          userPrompt: customPrompt,
        },
        projectId: activeProjectId,
        clipId: clip.id,
      })

      if (result.success && result.script && result.script.sections.length > 0) {
        useScriptStore.getState().setSections(result.script.sections)
        useScriptStore.getState().setClipScript(clip.id, result.script.sections)
      }
      if (result.generationLog) {
        setGenerationLog(result.generationLog)
      }
    } catch (err) {
      console.error('[ScriptTimelineView] Regeneration failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateVoiceovers = async () => {
    if (!window.leonardo?.tts?.synthesize) return
    const sections = useScriptStore.getState().sections
    if (sections.length === 0) return

    setGeneratingTTS(true)
    const voice: VoiceProfile = voices.find((v) => v.voiceId === selectedVoice) ?? {
      id: 'default',
      name: 'Default',
      provider: 'edge-tts' as TTSEngineType,
      voiceId: selectedVoice || 'en-US-AriaNeural',
      samples: [],
      isDefault: true,
    }

    try {
      const timeline = useTimelineStore.getState().timeline
      if (!timeline) return

      const clipSegments = timeline.tracks
        .filter((t) => t.type === 'clip' || t.type === 'recording')
        .flatMap((t) => t.segments)

      for (const section of sections) {
        const segment = clipSegments.find((s) => {
          if (!s.metadata) return false
          try {
            const meta = JSON.parse(s.metadata) as { sectionId?: string }
            return meta.sectionId === section.id
          } catch { return false }
        })

        const result = await window.leonardo.tts.synthesize({
          text: section.text,
          voice,
          engine: 'edge-tts' as TTSEngineType,
        })

        if (segment && result.duration > 0) {
          useTimelineStore.getState().adjustSegmentDuration(segment.id, result.duration)
        }

        // Compute a simple text hash for staleness tracking
        const textHash = String(section.text.length) + '-' + section.text.slice(0, 20)
        useScriptStore.getState().setVoiceover(section.id, result.filePath, textHash)
      }
    } catch (err) {
      console.error('[TTS] Voiceover generation failed:', err)
    } finally {
      setGeneratingTTS(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className="script-timeline-view"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
    >
      {/* Top: Video Preview — takes remaining space */}
      <div className="script-preview-section" style={{ flex: 1, minHeight: 120, overflow: 'hidden' }}>
        <PlaybackPanel />
      </div>

      {/* Resize Divider */}
      <div
        className="script-resize-divider"
        onMouseDown={handleMouseDown}
        style={{ height: 4, cursor: 'row-resize', background: '#252525', flexShrink: 0 }}
      />

      {/* Toolbar */}
      <div
        className="script-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          background: '#141414',
          borderBottom: '1px solid #252525',
          flexShrink: 0,
        }}
      >
        <button className="rec-btn" onClick={handleGenerateScript} disabled={generating || !activeProjectId}>
          {generating ? 'Generating...' : 'Generate Script'}
        </button>
        <button className="rec-btn" onClick={handleGenerateVoiceovers} disabled={generatingTTS}>
          {generatingTTS ? 'Generating...' : 'Generate Voiceovers'}
        </button>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          style={{
            background: '#1a1a1a',
            color: '#d0d0d0',
            border: '1px solid #252525',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 12,
          }}
        >
          <option value="">Default Voice</option>
          {voices.map((v) => (
            <option key={v.id} value={v.voiceId}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Generation Log (collapsible) */}
      <GenerationLog log={generationLog} onRegenerate={handleRegenerate} />

      {/* Compact Timeline — fixed height */}
      <div className="script-compact-timeline" style={{ height: 80, flexShrink: 0, overflow: 'hidden' }}>
        <Timeline />
      </div>
    </div>
  )
}
