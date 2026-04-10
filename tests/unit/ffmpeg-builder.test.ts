import { describe, it, expect } from 'vitest'
import {
  buildFreezeFrameFilter,
  buildZoomFilter,
  buildFadeFilter,
  buildOverlayFilter,
  buildAudioMixFilter,
  buildFFmpegArgs,
  buildEncodingArgs,
  type FreezeFrameEffect,
  type ZoomEffect,
  type FadeEffect,
} from '@main/utils/ffmpeg-builder'

describe('buildFreezeFrameFilter', () => {
  it('produces a filtergraph with split, trim, tpad, and concat', () => {
    const effect: FreezeFrameEffect = { type: 'freeze', timestamp: 5, duration: 3 }
    const filter = buildFreezeFrameFilter(effect, '0:v', 'frozen')

    expect(filter).toContain('split=3')
    expect(filter).toContain('trim=0:5')
    expect(filter).toContain('tpad=stop_mode=clone:stop_duration=3')
    expect(filter).toContain('[post_src]trim=5') // resume from freeze timestamp
    expect(filter).toContain('concat=n=3:v=1:a=0')
    expect(filter).toContain('[frozen]')
  })

  it('handles freeze at the beginning of video', () => {
    const effect: FreezeFrameEffect = { type: 'freeze', timestamp: 0, duration: 2 }
    const filter = buildFreezeFrameFilter(effect, '0:v', 'out')

    expect(filter).toContain('trim=0:0')
    expect(filter).toContain('tpad=stop_mode=clone:stop_duration=2')
    expect(filter).toContain('[post_src]trim=0') // resume from timestamp 0
  })

  it('produces valid semicolon-separated filter chain', () => {
    const effect: FreezeFrameEffect = { type: 'freeze', timestamp: 10, duration: 5 }
    const filter = buildFreezeFrameFilter(effect, 'input', 'output')

    const segments = filter.split(';')
    expect(segments.length).toBe(5)
  })
})

describe('buildZoomFilter', () => {
  it('produces zoompan filter with ease-in/ease-out', () => {
    const effect: ZoomEffect = {
      type: 'zoom',
      timestamp: 3,
      duration: 2,
      x: 100,
      y: 200,
      width: 400,
      height: 300,
      outputWidth: 1920,
      outputHeight: 1080,
    }
    const filter = buildZoomFilter(effect, '0:v', 'zoomed')

    expect(filter).toContain('zoompan')
    expect(filter).toContain('trim=3:5')
    expect(filter).toContain('s=1920x1080')
    expect(filter).toContain('fps=30')
    expect(filter).toContain('cos(PI')
    expect(filter).toContain('[zoomed]')
  })

  it('calculates correct zoom level from region to output', () => {
    const effect: ZoomEffect = {
      type: 'zoom',
      timestamp: 0,
      duration: 1,
      x: 0,
      y: 0,
      width: 960,
      height: 540,
      outputWidth: 1920,
      outputHeight: 1080,
    }
    const filter = buildZoomFilter(effect, '0:v', 'out')

    // Expected zoom: min(1920/960, 1080/540) = 2.0
    // So the filter should contain 1.0000 (zoomMax - 1)
    expect(filter).toContain('1.0000')
  })

  it('centers zoom on the target region', () => {
    const effect: ZoomEffect = {
      type: 'zoom',
      timestamp: 0,
      duration: 1,
      x: 100,
      y: 200,
      width: 300,
      height: 200,
      outputWidth: 1920,
      outputHeight: 1080,
    }
    const filter = buildZoomFilter(effect, 'in', 'out')

    // Center: (100 + 150, 200 + 100) = (250, 300)
    expect(filter).toContain('250-iw/2/zoom')
    expect(filter).toContain('300-ih/2/zoom')
  })
})

describe('buildFadeFilter', () => {
  it('produces fade-in filter', () => {
    const effect: FadeEffect = { type: 'fade', direction: 'in', timestamp: 0, duration: 1 }
    const filter = buildFadeFilter(effect, '0:v', 'faded')

    expect(filter).toContain('fade=t=in')
    expect(filter).toContain('st=0')
    expect(filter).toContain('d=1')
    expect(filter).toContain('[faded]')
  })

  it('produces fade-out filter', () => {
    const effect: FadeEffect = { type: 'fade', direction: 'out', timestamp: 10, duration: 2 }
    const filter = buildFadeFilter(effect, 'input', 'output')

    expect(filter).toContain('fade=t=out')
    expect(filter).toContain('st=10')
    expect(filter).toContain('d=2')
  })
})

describe('buildOverlayFilter', () => {
  it('produces overlay filter with time-based enable', () => {
    const filter = buildOverlayFilter('base', 'overlay', 'out', {
      x: 50,
      y: 100,
      startTime: 5,
      endTime: 10,
    })

    expect(filter).toContain('overlay')
    expect(filter).toContain('x=50')
    expect(filter).toContain('y=100')
    expect(filter).toContain('between(t,5,10)')
    expect(filter).toContain('[base]')
    expect(filter).toContain('[overlay]')
    expect(filter).toContain('[out]')
  })
})

describe('buildAudioMixFilter', () => {
  it('produces amix filter for multiple inputs', () => {
    const filter = buildAudioMixFilter(['audio1', 'audio2', 'audio3'], 'mixed')

    expect(filter).toContain('[audio1][audio2][audio3]')
    expect(filter).toContain('amix=inputs=3')
    expect(filter).toContain('normalize=1')
    expect(filter).toContain('[mixed]')
  })

  it('disables normalization when requested', () => {
    const filter = buildAudioMixFilter(['a', 'b'], 'out', { normalize: false })

    expect(filter).toContain('normalize=0')
  })
})

describe('buildFFmpegArgs', () => {
  it('builds complete argument list', () => {
    const args = buildFFmpegArgs({
      inputs: [
        { path: '/input/video.mp4' },
        { path: '/input/audio.wav' },
      ],
      filtergraph: '[0:v]fade=t=in:st=0:d=1[out]',
      outputArgs: ['-map', '[out]', '-c:v', 'libx264'],
      outputPath: '/output/result.mp4',
    })

    expect(args).toEqual([
      '-i', '/input/video.mp4',
      '-i', '/input/audio.wav',
      '-filter_complex', '[0:v]fade=t=in:st=0:d=1[out]',
      '-map', '[out]',
      '-c:v', 'libx264',
      '-y', '/output/result.mp4',
    ])
  })

  it('handles input-specific args', () => {
    const args = buildFFmpegArgs({
      inputs: [
        { path: '/input/video.mp4', args: ['-ss', '5'] },
      ],
      filtergraph: '',
      outputArgs: ['-c:v', 'copy'],
      outputPath: '/output/out.mp4',
    })

    expect(args[0]).toBe('-ss')
    expect(args[1]).toBe('5')
    expect(args[2]).toBe('-i')
  })

  it('omits filtergraph when empty', () => {
    const args = buildFFmpegArgs({
      inputs: [{ path: '/in.mp4' }],
      filtergraph: '',
      outputArgs: [],
      outputPath: '/out.mp4',
    })

    expect(args).not.toContain('-filter_complex')
  })
})

describe('buildEncodingArgs', () => {
  it('builds H.264 encoding args', () => {
    const args = buildEncodingArgs('h264')
    expect(args).toContain('libx264')
    expect(args).toContain('-crf')
    expect(args).toContain('-movflags')
  })

  it('builds H.265 encoding args', () => {
    const args = buildEncodingArgs('h265')
    expect(args).toContain('libx265')
    expect(args).toContain('hvc1')
  })

  it('builds ProRes encoding args', () => {
    const args = buildEncodingArgs('prores')
    expect(args).toContain('prores_ks')
    expect(args).toContain('pcm_s16le')
  })

  it('includes map labels when provided', () => {
    const args = buildEncodingArgs('h264', { video: 'vout', audio: 'aout' })
    expect(args).toContain('-map')
    expect(args).toContain('[vout]')
    expect(args).toContain('[aout]')
  })
})
