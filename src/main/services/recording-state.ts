/**
 * Shared recording state between main index and recording IPC.
 * Separate module to avoid circular imports and side effects.
 */
let recordingWebviewId: number | null = null

export function setRecordingWebviewId(id: number | null): void {
  recordingWebviewId = id
}

export function getRecordingWebviewId(): number | null {
  return recordingWebviewId
}
