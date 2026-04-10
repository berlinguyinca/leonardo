import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import type { ITTSProvider } from '@shared/interfaces/tts-provider'
import type { VoiceProfile, TTSSynthesisResult } from '@shared/types/tts'

export class PiperProvider implements ITTSProvider {
  readonly name = 'Piper'
  private binaryPath: string
  private modelsDir: string

  constructor(binaryPath?: string, modelsDir?: string) {
    this.binaryPath = binaryPath ?? this.findPiperBinary()
    this.modelsDir = modelsDir ?? ''
  }

  get isAvailable(): boolean {
    return existsSync(this.binaryPath)
  }

  async synthesize(text: string, voice: VoiceProfile): Promise<TTSSynthesisResult> {
    const outputPath = join(
      require('os').tmpdir(),
      `leonardo-tts-${Date.now()}-${voice.voiceId}.wav`,
    )

    return new Promise((resolve, reject) => {
      const modelPath = voice.voiceId // voiceId stores the model file path for Piper
      const args = ['--model', modelPath, '--output_file', outputPath]

      const proc = spawn(this.binaryPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })

      // Pipe text to stdin
      proc.stdin.write(text)
      proc.stdin.end()

      let stderr = ''
      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0 && existsSync(outputPath)) {
          // Estimate duration: ~150 words per minute for TTS
          const wordCount = text.split(/\s+/).length
          const estimatedDuration = (wordCount / 150) * 60 * 1000
          resolve({
            filePath: outputPath,
            duration: estimatedDuration,
            sectionId: '',
          })
        } else {
          reject(new Error(`Piper TTS failed (code ${code}): ${stderr.slice(-200)}`))
        }
      })

      proc.on('error', (err) => {
        reject(new Error(`Piper TTS process error: ${err.message}`))
      })
    })
  }

  async getVoices(): Promise<VoiceProfile[]> {
    // List available Piper models from the models directory
    if (!this.modelsDir || !existsSync(this.modelsDir)) return []

    const { readdirSync } = require('fs')
    const files = readdirSync(this.modelsDir) as string[]
    return files
      .filter((f: string) => f.endsWith('.onnx'))
      .map((f: string) => ({
        id: f.replace('.onnx', ''),
        name: f.replace('.onnx', '').replace(/-/g, ' '),
        provider: 'piper' as const,
        voiceId: join(this.modelsDir, f),
        samples: [],
        isDefault: false,
      }))
  }

  async testConnection(): Promise<boolean> {
    return this.isAvailable
  }

  private findPiperBinary(): string {
    // Check bundled location
    if (process.resourcesPath) {
      const ext = process.platform === 'win32' ? '.exe' : ''
      const bundled = join(process.resourcesPath, 'piper', `piper${ext}`)
      if (existsSync(bundled)) return bundled
    }
    // Fallback to system path
    return 'piper'
  }
}
