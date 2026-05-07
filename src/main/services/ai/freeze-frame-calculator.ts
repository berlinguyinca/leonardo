export interface FreezeFrameResult {
  needed: boolean
  duration: number // freeze duration in seconds (0 if not needed)
  calculated: number // the WPM-calculated duration before any override
  overridden: boolean // whether user override was applied
}

export interface FreezeFrameInput {
  scriptText: string // the narration text for this section
  eventGapSeconds: number // time between last event in section and section end
  freezeOverride?: number | null // user-specified override duration in seconds
  wpm?: number // words per minute (default 150)
}

export function calculateFreezeFrame(input: FreezeFrameInput): FreezeFrameResult {
  const wpm = input.wpm ?? 150
  const wordCount = input.scriptText.trim().split(/\s+/).filter(Boolean).length
  const narrationDurationSec = (wordCount / wpm) * 60
  const calculated = Math.max(0, narrationDurationSec - input.eventGapSeconds)
  // Round to nearest 0.5s
  const roundedCalculated = Math.round(calculated * 2) / 2

  if (input.freezeOverride != null) {
    return {
      needed: input.freezeOverride > 0,
      duration: input.freezeOverride,
      calculated: roundedCalculated,
      overridden: true,
    }
  }

  return {
    needed: roundedCalculated > 0,
    duration: roundedCalculated,
    calculated: roundedCalculated,
    overridden: false,
  }
}
