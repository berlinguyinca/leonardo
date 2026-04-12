import type { ScriptSection, TimingMarker, ActionMarker } from '@shared/types/ai'
import { v4 as uuidv4 } from 'uuid'

/**
 * Parses raw AI-generated script text into structured ScriptSection objects.
 *
 * Expected format: numbered sections with inline timing markers.
 * Example:
 *   1. Welcome to this tutorial. [PAUSE 1.0]
 *   Let me show you how to submit a form. [ZOOM .submit-btn]
 *
 *   2. [TRANSITION fade] Now click the submit button. [FREEZE 2.0]
 *   [ACTION: evt-001 "Click submit"]
 */
export function parseScriptText(text: string, scriptId: string): ScriptSection[] {
  const sections: ScriptSection[] = []
  const rawSections = splitIntoSections(text)

  for (let i = 0; i < rawSections.length; i++) {
    const raw = rawSections[i]
    const { cleanText, markers } = extractTimingMarkers(raw)
    const actionMarkers = extractActionMarkers(raw)

    if (cleanText.trim().length === 0) continue

    sections.push({
      id: uuidv4(),
      scriptId,
      text: cleanText.trim(),
      voiceProfileId: null,
      startTime: 0,
      endTime: 0,
      timingMarkers: markers,
      actionMarkers: actionMarkers.length > 0 ? actionMarkers : undefined,
      order: i,
    })
  }

  return sections
}

/**
 * Split text into sections by numbered prefixes or double newlines.
 */
function splitIntoSections(text: string): string[] {
  // Try numbered sections first: "1. ...", "2. ...", etc.
  const numbered = text.split(/\n\s*\d+\.\s+/).filter((s) => s.trim().length > 0)
  if (numbered.length > 1) return numbered

  // Fall back to double-newline splitting
  const paragraphs = text.split(/\n\s*\n/).filter((s) => s.trim().length > 0)
  if (paragraphs.length > 1) return paragraphs

  // Single section
  return [text]
}

/**
 * Extract timing markers from text and return clean text + markers array.
 */
export function extractTimingMarkers(text: string): {
  cleanText: string
  markers: TimingMarker[]
} {
  const markers: TimingMarker[] = []
  let cleanText = text

  // [PAUSE duration]
  const pauseRegex = /\[PAUSE\s+([\d.]+)\]/gi
  let match: RegExpExecArray | null
  while ((match = pauseRegex.exec(text)) !== null) {
    markers.push({
      type: 'pause',
      position: match.index,
      duration: parseFloat(match[1]),
    })
  }
  cleanText = cleanText.replace(pauseRegex, '')

  // [ZOOM selector]
  const zoomRegex = /\[ZOOM\s+([^\]]+)\]/gi
  while ((match = zoomRegex.exec(text)) !== null) {
    markers.push({
      type: 'zoom',
      position: match.index,
      selector: match[1].trim(),
    })
  }
  cleanText = cleanText.replace(zoomRegex, '')

  // [FREEZE duration]
  const freezeRegex = /\[FREEZE\s+([\d.]+)\]/gi
  while ((match = freezeRegex.exec(text)) !== null) {
    markers.push({
      type: 'freeze',
      position: match.index,
      duration: parseFloat(match[1]),
    })
  }
  cleanText = cleanText.replace(freezeRegex, '')

  // [TRANSITION type]
  const transitionRegex = /\[TRANSITION\s+(\w+)\]/gi
  while ((match = transitionRegex.exec(text)) !== null) {
    markers.push({
      type: 'transition',
      position: match.index,
      transitionType: match[1].trim().toLowerCase(),
    })
  }
  cleanText = cleanText.replace(transitionRegex, '')

  // Remove ACTION markers from clean text as well
  cleanText = cleanText.replace(/\[ACTION:\s+[^\]]+\]/gi, '')

  return { cleanText, markers }
}

/**
 * Extract [ACTION: eventId "description"] markers from text.
 */
export function extractActionMarkers(text: string): ActionMarker[] {
  const markers: ActionMarker[] = []
  const actionRegex = /\[ACTION:\s+(\S+)\s+"([^"]+)"\]/gi
  let match: RegExpExecArray | null
  while ((match = actionRegex.exec(text)) !== null) {
    markers.push({
      eventId: match[1],
      position: match.index,
      label: match[2],
    })
  }
  return markers
}
