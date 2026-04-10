export const APP_NAME = 'Leonardo'
export const DB_FILENAME = 'leonardo.db'
export const AUTO_SAVE_INTERVAL_MS = 30_000
export const WORKER_HEARTBEAT_INTERVAL_MS = 5_000
export const WORKER_HEARTBEAT_TIMEOUT_MS = 15_000
export const UNDO_HISTORY_LIMIT = 100
export const MAX_RECENT_PROJECTS = 20

export const IPC_CHANNELS = {
  PROJECT_CREATE: 'project:create',
  PROJECT_GET: 'project:get',
  PROJECT_LIST: 'project:list',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  AI_GENERATE_SCRIPT: 'ai:generate-script',
  TTS_SYNTHESIZE: 'tts:synthesize',
  RENDER_START: 'render:start',
  RENDER_PROGRESS: 'render:progress',
  RENDER_CANCEL: 'render:cancel',
  EXPORT_START: 'export:start',
  WORKER_STATUS: 'worker:status',
} as const
