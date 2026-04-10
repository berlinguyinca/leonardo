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

function summarizeDOMEvents(events: DOMEvent[]): string {
  if (events.length === 0) return '(no DOM events captured)'

  return events
    .map((e) => {
      const time = (e.timestamp / 1000).toFixed(1)
      switch (e.type) {
        case 'click':
          return `[${time}s] Click on "${e.elementText || e.elementSelector}" at (${e.coordinates.x}, ${e.coordinates.y})`
        case 'submit':
          return `[${time}s] Form submitted: ${e.elementSelector}`
        case 'navigate':
          return `[${time}s] Navigate to: ${e.url}`
        case 'focus':
          return `[${time}s] Focus on input: ${e.elementText || e.elementSelector}`
        case 'input':
          return `[${time}s] Type in: ${e.elementSelector} ${e.value || ''}`
        case 'scroll':
          return `[${time}s] Scroll to (${e.coordinates.x}, ${e.coordinates.y})`
        default:
          return `[${time}s] ${e.type}: ${e.elementSelector}`
      }
    })
    .join('\n')
}
