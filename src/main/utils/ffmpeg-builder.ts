/**
 * Composable FFmpeg filtergraph builder for video effects.
 *
 * Each effect produces a FiltergraphSegment with input/output labels.
 * The builder chains segments into a complete filtergraph string.
 */

export interface FiltergraphSegment {
  filter: string
  inputLabel: string
  outputLabel: string
}

export interface FreezeFrameEffect {
  type: 'freeze'
  timestamp: number    // seconds
  duration: number     // seconds
}

export interface ZoomEffect {
  type: 'zoom'
  timestamp: number    // seconds
  duration: number     // seconds
  x: number            // target region top-left X (pixels)
  y: number            // target region top-left Y (pixels)
  width: number        // target region width (pixels)
  height: number       // target region height (pixels)
  outputWidth: number  // video output width
  outputHeight: number // video output height
}

export interface FadeEffect {
  type: 'fade'
  direction: 'in' | 'out'
  timestamp: number    // seconds
  duration: number     // seconds
}

export type VideoEffect = FreezeFrameEffect | ZoomEffect | FadeEffect

/**
 * Build a freeze-frame filtergraph: extract frame at timestamp, hold for duration.
 *
 * Strategy: split video into 3 parts (before, frozen frame, after), concatenate.
 * Uses tpad filter to repeat the last frame of a trimmed segment.
 */
export function buildFreezeFrameFilter(
  effect: FreezeFrameEffect,
  inputLabel: string,
  outputLabel: string,
): string {
  const { timestamp, duration } = effect

  // Freeze = INSERT time: play up to timestamp, hold frame for duration, resume from timestamp.
  // Total output duration = original duration + freeze duration.
  return [
    // Part 1: video before the freeze point
    `[${inputLabel}]split=3[pre][freeze_src][post_src]`,
    // Trim pre-section
    `[pre]trim=0:${timestamp},setpts=PTS-STARTPTS[pre_out]`,
    // Extract single frame at timestamp, extend it to the desired freeze duration
    `[freeze_src]trim=${timestamp}:${timestamp + 0.04},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${duration}[freeze_out]`,
    // Post-section: resume from the freeze timestamp (not timestamp+duration)
    `[post_src]trim=${timestamp},setpts=PTS-STARTPTS[post_out]`,
    // Concatenate all three parts
    `[pre_out][freeze_out][post_out]concat=n=3:v=1:a=0[${outputLabel}]`,
  ].join(';')
}

/**
 * Build a zoom-in filtergraph: crop region + scale to output, with ease-in/ease-out.
 *
 * Uses the zoompan filter for smooth zoom animation.
 * zoom goes from 1.0 to (outputWidth/regionWidth) over the duration.
 */
export function buildZoomFilter(
  effect: ZoomEffect,
  inputLabel: string,
  outputLabel: string,
): string {
  const { timestamp, duration, x, y, width, height, outputWidth, outputHeight } = effect
  const fps = 30
  const totalFrames = Math.round(duration * fps)
  const zoomMax = Math.min(outputWidth / width, outputHeight / height)

  // Ease-in-out: use sin function for smooth transition
  // z = 1 + (zoomMax-1) * (1 - cos(PI*on/totalFrames)) / 2
  const zoomExpr = `1+(${(zoomMax - 1).toFixed(4)})*(1-cos(PI*on/${totalFrames}))/2`

  // Center the zoom on the target region
  const centerX = x + width / 2
  const centerY = y + height / 2

  return [
    // Trim to the zoom section
    `[${inputLabel}]trim=${timestamp}:${timestamp + duration},setpts=PTS-STARTPTS`,
    // Apply zoompan
    `zoompan=z='${zoomExpr}':x='${centerX}-iw/2/zoom':y='${centerY}-ih/2/zoom':d=${totalFrames}:s=${outputWidth}x${outputHeight}:fps=${fps}`,
    `setpts=PTS-STARTPTS[${outputLabel}]`,
  ].join(',')
}

/**
 * Build a fade filtergraph (in or out).
 */
export function buildFadeFilter(
  effect: FadeEffect,
  inputLabel: string,
  outputLabel: string,
): string {
  const { direction, timestamp, duration } = effect
  const fadeType = direction === 'in' ? 'fade=t=in' : 'fade=t=out'
  return `[${inputLabel}]${fadeType}:st=${timestamp}:d=${duration}[${outputLabel}]`
}

/**
 * Build an overlay filter: place an image/video on top of another at specified time range.
 */
export function buildOverlayFilter(
  baseLabel: string,
  overlayLabel: string,
  outputLabel: string,
  options: {
    x: number
    y: number
    startTime: number
    endTime: number
  },
): string {
  const { x, y, startTime, endTime } = options
  const enable = `between(t,${startTime},${endTime})`
  return `[${baseLabel}][${overlayLabel}]overlay=x=${x}:y=${y}:enable='${enable}'[${outputLabel}]`
}

/**
 * Build an audio mix filter: combine multiple audio streams.
 */
export function buildAudioMixFilter(
  inputLabels: string[],
  outputLabel: string,
  options?: { normalize?: boolean },
): string {
  const inputs = inputLabels.map((l) => `[${l}]`).join('')
  const normalize = options?.normalize !== false ? 1 : 0
  return `${inputs}amix=inputs=${inputLabels.length}:normalize=${normalize}[${outputLabel}]`
}

/**
 * Assemble a complete FFmpeg command from effects and inputs.
 */
export interface FFmpegCommand {
  inputs: FFmpegInput[]
  filtergraph: string
  outputArgs: string[]
  outputPath: string
}

export interface FFmpegInput {
  path: string
  args?: string[]
}

export function buildFFmpegArgs(cmd: FFmpegCommand): string[] {
  const args: string[] = []

  // Input files
  for (const input of cmd.inputs) {
    if (input.args) args.push(...input.args)
    args.push('-i', input.path)
  }

  // Filtergraph
  if (cmd.filtergraph) {
    args.push('-filter_complex', cmd.filtergraph)
  }

  // Output args
  args.push(...cmd.outputArgs)

  // Output path
  args.push('-y', cmd.outputPath)

  return args
}

/**
 * Build output encoding args for common codecs.
 */
export function buildEncodingArgs(codec: 'h264' | 'h265' | 'prores', mapLabels?: { video?: string; audio?: string }): string[] {
  const args: string[] = []

  if (mapLabels?.video) args.push('-map', `[${mapLabels.video}]`)
  if (mapLabels?.audio) args.push('-map', `[${mapLabels.audio}]`)

  switch (codec) {
    case 'h264':
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart')
      break
    case 'h265':
      args.push('-c:v', 'libx265', '-preset', 'fast', '-crf', '28', '-tag:v', 'hvc1', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart')
      break
    case 'prores':
      args.push('-c:v', 'prores_ks', '-profile:v', '3', '-c:a', 'pcm_s16le')
      break
  }

  return args
}
