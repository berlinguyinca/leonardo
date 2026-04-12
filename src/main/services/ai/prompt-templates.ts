import type { ScriptGenContext } from '@shared/types/ai'
import type { DOMEvent } from '@shared/types/events'

const SYSTEM_PROMPT = `You are a video tutorial scriptwriter for Leonardo, an AI-powered video production tool.

Given a recording description, DOM interaction events, and a user prompt, write a clear, engaging narration script for a software tutorial video.

Output format:
- Write the script as numbered sections, one paragraph per section
- Each section should narrate what's happening on screen during that time segment
- Include timing markers inline using these formats:
  [PAUSE 1.5] — pause narration for 1.5 seconds
  [ZOOM .selector] — zoom into the specified CSS selector
  [FREEZE 2.0] — freeze the frame for 2.0 seconds
  [TRANSITION fade] — add a fade transition before this section
  [ACTION: eventId "description"] — link narration to a specific DOM event by its ID, with a human-readable description of the action

ACTION marker usage:
- Use [ACTION: <eventId> "<description>"] to connect script sections to recorded DOM events
- The eventId should reference an event from the interaction timeline below
- The description should be a concise label for what the user did, e.g. "Click submit button"
- Example: [ACTION: evt-001 "Click the login button"]
- Multiple ACTION markers can appear in a single section

Guidelines:
- Use a professional but approachable tone
- Explain what the user is doing and why
- Highlight important UI elements and actions
- Keep sentences concise and easy to follow when spoken
- Include brief pauses after important actions
- Start with a brief introduction and end with a summary`

export function buildScriptPrompt(context: ScriptGenContext): string {
  const eventsSummary = summarizeDOMEvents(context.domEvents)

  return `${context.userPrompt}

Recording details:
- URL: ${context.url}
- Duration: ${(context.recordingDuration / 1000).toFixed(1)} seconds
- Total interactions: ${context.domEvents.length}

Interaction timeline:
${eventsSummary}

Write a narration script for this tutorial recording.`
}

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT
}

function describeElement(e: DOMEvent): string {
  const parts: string[] = []
  if (e.tagName) {
    let tag = `<${e.tagName}`
    if (e.elementType) tag += ` type="${e.elementType}"`
    if (e.role) tag += ` role="${e.role}"`
    if (e.ariaLabel) tag += ` aria-label="${e.ariaLabel}"`
    tag += '>'
    parts.push(tag)
  }
  if (e.elementText) parts.push(`"${e.elementText}"`)
  if (e.href) parts.push(`(href: ${e.href})`)
  if (e.alt) parts.push(`(alt: ${e.alt})`)
  if (e.title) parts.push(`(title: ${e.title})`)
  if (parts.length > 0) return parts.join(' ')
  return e.elementSelector
}

function summarizeDOMEvents(events: DOMEvent[]): string {
  if (events.length === 0) return '(no DOM events captured)'

  return events
    .map((e) => {
      const time = (e.timestamp / 1000).toFixed(1)
      switch (e.type) {
        case 'click':
          return `[${time}s] Click on ${describeElement(e)} at (${e.coordinates.x}, ${e.coordinates.y})`
        case 'submit':
          return `[${time}s] Form submitted: ${describeElement(e)}`
        case 'navigate':
          return `[${time}s] Navigate to: ${e.url}`
        case 'focus': {
          const desc = e.placeholder ? `"${e.placeholder}"` : (e.elementText || describeElement(e))
          return `[${time}s] Focus on input: ${desc}`
        }
        case 'input':
          return `[${time}s] Type in: ${describeElement(e)} ${e.value || ''}`
        case 'scroll':
          return `[${time}s] Scroll to (${e.coordinates.x}, ${e.coordinates.y})`
        default:
          return `[${time}s] ${e.type}: ${e.elementSelector}`
      }
    })
    .join('\n')
}
