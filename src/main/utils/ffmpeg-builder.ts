/**
 * Composable FFmpeg filtergraph builder for video effects.
 *
 * Each effect produces a FiltergraphSegment with input/output labels.
 * The builder chains segments into a complete filtergraph string.
 */

import type { Segment } from '@shared/types'
import { parseOverlayMetadata } from '@shared/types'

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
 * Build FFmpeg drawtext filter strings for text overlay segments.
 * Each overlay segment produces one drawtext filter.
 * These are separate from buildOverlayFilter — drawtext renders text directly
 * into the video stream without requiring a separate image input.
 */
export function buildDrawtextFilters(
  overlaySegments: Segment[],
  videoWidth: number,
  videoHeight: number,
): string[] {
  const filters: string[] = []

  for (const seg of overlaySegments) {
    const meta = parseOverlayMetadata(seg)
    if (!meta) continue

    const el = meta.element
    const startSec = seg.startTime / 1000
    const endSec = seg.endTime / 1000

    // Convert percentage position to pixel coordinates
    const x = Math.round((el.x / 100) * videoWidth)
    const y = Math.round((el.y / 100) * videoHeight)

    // Escape text for FFmpeg drawtext (backslashes, single quotes, colons)
    const escapedText = el.text
      .replace(/\\/g, '\\\\\\\\')
      .replace(/'/g, "'\\\\\\''")
      .replace(/:/g, '\\\\:')

    // Build base drawtext filter parts
    const parts: string[] = [
      `text='${escapedText}'`,
      `x=${x}`,
      `y=${y}`,
      `fontsize=${el.fontSize}`,
      `fontcolor=${el.color}`,
      `enable='between(t,${startSec.toFixed(3)},${endSec.toFixed(3)})'`,
    ]

    // Font family (use font= for system fonts)
    if (el.fontFamily) {
      parts.push(`font='${el.fontFamily}'`)
    }

    // Background box
    if (el.backgroundColor && el.backgroundOpacity > 0) {
      const opacity = Math.round(el.backgroundOpacity * 255)
        .toString(16)
        .padStart(2, '0')
      parts.push(`box=1`)
      parts.push(`boxcolor=${el.backgroundColor}@0x${opacity}`)
      parts.push(`boxborderw=10`)
    }

    // Alpha fade expressions for transitions.
    // v1 limitation: slide and typewriter transitions are not yet reflected in alpha.
    const hasFadeIn = el.transitionIn === 'fade' && el.transitionDuration > 0
    const hasFadeOut = el.transitionOut === 'fade' && el.transitionDuration > 0
    if (hasFadeIn || hasFadeOut) {
      const fadeDur = (el.transitionDuration / 1000).toFixed(3)
      const start = startSec.toFixed(3)
      const end = endSec.toFixed(3)
      let alphaExpr: string
      if (hasFadeIn && hasFadeOut) {
        // Fade in at start, fade out at end — take the minimum of both ramps
        const fadeInRamp = `if(lt(t-${start},${fadeDur}),(t-${start})/${fadeDur},1)`
        const fadeOutRamp = `if(gt(t,${end}-${fadeDur}),(${end}-t)/${fadeDur},1)`
        alphaExpr = `min(${fadeInRamp},${fadeOutRamp})`
      } else if (hasFadeIn) {
        alphaExpr = `if(lt(t-${start},${fadeDur}),(t-${start})/${fadeDur},1)`
      } else {
        // hasFadeOut only
        alphaExpr = `if(gt(t,${end}-${fadeDur}),(${end}-t)/${fadeDur},1)`
      }
      parts.push(`alpha='${alphaExpr}'`)
    }

    filters.push(`drawtext=${parts.join(':')}`)
  }

  return filters
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
