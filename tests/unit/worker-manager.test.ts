import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  registerWorker,
  reportHeartbeat,
  getWorkerStatus,
  getAllWorkerStatuses,
  startHeartbeatMonitor,
  stopHeartbeatMonitor,
} from '@main/workers/worker-manager'

describe('worker-manager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stopHeartbeatMonitor()
  })

  afterEach(() => {
    stopHeartbeatMonitor()
    vi.useRealTimers()
  })

  it('registers a worker with idle status', () => {
    registerWorker('ai')
    const status = getWorkerStatus('ai')
    expect(status).toBeDefined()
    expect(status!.type).toBe('ai')
    expect(status!.status).toBe('idle')
    expect(status!.restartCount).toBe(0)
  })

  it('updates heartbeat and sets status to running', () => {
    registerWorker('render')
    reportHeartbeat('render')
    const status = getWorkerStatus('render')
    expect(status!.status).toBe('running')
  })

  it('getAllWorkerStatuses returns all registered workers', () => {
    registerWorker('recording')
    registerWorker('tts')
    const all = getAllWorkerStatuses()
    const types = all.map((w) => w.type)
    expect(types).toContain('recording')
    expect(types).toContain('tts')
  })

  it('detects crash when heartbeat times out', () => {
    registerWorker('ai')
    reportHeartbeat('ai')

    const onCrash = vi.fn()
    const onRestart = vi.fn()
    startHeartbeatMonitor({ onWorkerCrash: onCrash, onWorkerRestart: onRestart })

    // Advance past the heartbeat timeout (15s) + one check interval (5s)
    vi.advanceTimersByTime(20_000)

    expect(onCrash).toHaveBeenCalledWith('ai')
    expect(onRestart).toHaveBeenCalledWith('ai')
  })

  it('does not report crash for idle workers', () => {
    registerWorker('tts')
    // Don't report heartbeat — worker stays idle

    const onCrash = vi.fn()
    const onRestart = vi.fn()
    startHeartbeatMonitor({ onWorkerCrash: onCrash, onWorkerRestart: onRestart })

    vi.advanceTimersByTime(30_000)

    expect(onCrash).not.toHaveBeenCalled()
  })

  it('does not report crash when heartbeats arrive on time', () => {
    registerWorker('render')
    reportHeartbeat('render')

    const onCrash = vi.fn()
    const onRestart = vi.fn()
    startHeartbeatMonitor({ onWorkerCrash: onCrash, onWorkerRestart: onRestart })

    // Send heartbeats faster than the timeout
    vi.advanceTimersByTime(4_000)
    reportHeartbeat('render')
    vi.advanceTimersByTime(4_000)
    reportHeartbeat('render')
    vi.advanceTimersByTime(4_000)
    reportHeartbeat('render')

    expect(onCrash).not.toHaveBeenCalled()
  })

  it('increments restartCount on crash', () => {
    registerWorker('ai')
    reportHeartbeat('ai')

    const onCrash = vi.fn()
    const onRestart = vi.fn()
    startHeartbeatMonitor({ onWorkerCrash: onCrash, onWorkerRestart: onRestart })

    vi.advanceTimersByTime(20_000)

    const status = getWorkerStatus('ai')
    expect(status!.restartCount).toBe(1)
  })
})
