export const APP_NAME = 'Leonardo'
export const DB_FILENAME = 'leonardo.db'
export const AUTO_SAVE_INTERVAL_MS = 30_000
export const WORKER_HEARTBEAT_INTERVAL_MS = 5_000
export const WORKER_HEARTBEAT_TIMEOUT_MS = 15_000
export const UNDO_HISTORY_LIMIT = 100
export const MAX_RECENT_PROJECTS = 20
export const LEONARDO_ARCHIVE_EXTENSION = '.leonardo'
export const LEONARDO_ARCHIVE_DB_NAME = 'project.db'
export const LEONARDO_ARCHIVE_MEDIA_DIR = 'media'
export const LEONARDO_ARCHIVE_THUMBNAILS_DIR = 'thumbnails'
export const LEONARDO_ARCHIVE_SETTINGS_FILE = 'settings.json'

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
  ARCHIVE_EXPORT: 'archive:export',
  ARCHIVE_IMPORT: 'archive:import',
  CLIP_CREATE: 'clip:create',
  CLIP_LIST: 'clip:list',
  CLIP_DELETE: 'clip:delete',
  CLIP_EXPORT: 'clip:export',
  LOG_READ: 'log:read',
} as const

export const TIMELINE_MIN_ZOOM = 0.1
export const TIMELINE_MAX_ZOOM = 10
export const TIMELINE_DEFAULT_ZOOM = 1
export const TIMELINE_SNAP_THRESHOLD_PX = 10
export const TIMELINE_SEGMENT_MIN_DURATION_MS = 100
export const TIMELINE_EDGE_HIT_ZONE_PX = 6
export const SYNC_POINT_COLORS: Record<string, string> = {
  freeze: '#3b82f6',
  zoom: '#22c55e',
  annotation: '#f59e0b',
  transition: '#a855f7',
}
