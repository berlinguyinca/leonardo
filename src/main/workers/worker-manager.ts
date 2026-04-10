import { WORKER_HEARTBEAT_INTERVAL_MS, WORKER_HEARTBEAT_TIMEOUT_MS } from '@shared/constants'

export type WorkerType = 'recording' | 'ai' | 'tts' | 'render'

export type WorkerStatus = 'idle' | 'running' | 'crashed' | 'restarting'

export interface WorkerInfo {
  type: WorkerType
  status: WorkerStatus
  lastHeartbeat: number
  restartCount: number
  pid: number | null
}

interface WorkerManagerCallbacks {
  onWorkerCrash: (type: WorkerType) => void
  onWorkerRestart: (type: WorkerType) => void
}

const workers: Map<WorkerType, WorkerInfo> = new Map()
let heartbeatInterval: ReturnType<typeof setInterval> | null = null

export function registerWorker(type: WorkerType): void {
  workers.set(type, {
    type,
    status: 'idle',
    lastHeartbeat: Date.now(),
    restartCount: 0,
    pid: null,
  })
}

export function reportHeartbeat(type: WorkerType): void {
  const info = workers.get(type)
  if (info) {
    info.lastHeartbeat = Date.now()
    info.status = 'running'
  }
}

export function getWorkerStatus(type: WorkerType): WorkerInfo | undefined {
  return workers.get(type)
}

export function getAllWorkerStatuses(): WorkerInfo[] {
  return Array.from(workers.values())
}

export function startHeartbeatMonitor(callbacks: WorkerManagerCallbacks): void {
  if (heartbeatInterval) return

  heartbeatInterval = setInterval(() => {
    const now = Date.now()
    for (const [type, info] of workers) {
      if (info.status === 'running' && now - info.lastHeartbeat > WORKER_HEARTBEAT_TIMEOUT_MS) {
        info.status = 'crashed'
        callbacks.onWorkerCrash(type)

        // Auto-restart
        info.status = 'restarting'
        info.restartCount++
        info.lastHeartbeat = now
        info.status = 'idle'
        callbacks.onWorkerRestart(type)
      }
    }
  }, WORKER_HEARTBEAT_INTERVAL_MS)
}

export function stopHeartbeatMonitor(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
}
