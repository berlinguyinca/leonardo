import type { Project } from '../types/project'
import type { ExportTarget, ExportResult } from '../types/export'

export type ExportProgressCallback = (progress: number, stage: string) => void

export interface IExportProvider {
  readonly name: string
  readonly isAvailable: boolean

  export(
    project: Project,
    target: ExportTarget,
    onProgress?: ExportProgressCallback,
  ): Promise<ExportResult>

  validateTarget(target: ExportTarget): Promise<{ valid: boolean; error?: string }>
}
