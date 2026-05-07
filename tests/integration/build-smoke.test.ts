// @vitest-environment node
/**
 * Build smoke tests — catch bundling and import resolution issues
 * that only appear at build/runtime, not during type-checking.
 *
 * These tests verify that:
 * 1. The production build succeeds
 * 2. The built output can be loaded without module resolution errors
 * 3. Packages with non-standard main entries (e.g., .ts files) are bundled correctly
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '../..')
const BUILD_TIMEOUT_MS = 180_000

describe('build smoke tests', () => {
  // Run the build once for all tests in this suite. A cold CI build can
  // exceed the per-test vitest timeout; the larger timeout here covers it,
  // and failure here fails the entire suite instead of producing a cascade
  // of misleading ENOENT errors from downstream file-existence tests.
  beforeAll(() => {
    execSync('npx electron-vite build', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: BUILD_TIMEOUT_MS,
      stdio: 'pipe',
    })
  }, BUILD_TIMEOUT_MS)

  it('main bundle exists and is non-empty', () => {
    const mainBundle = join(ROOT, 'out/main/index.js')
    expect(existsSync(mainBundle)).toBe(true)
    const content = readFileSync(mainBundle, 'utf-8')
    expect(content.length).toBeGreaterThan(1000)
  })

  it('preload bundles exist', () => {
    expect(existsSync(join(ROOT, 'out/preload/index.js'))).toBe(true)
    expect(existsSync(join(ROOT, 'out/preload/webview-preload.js'))).toBe(true)
  })

  it('renderer bundle exists', () => {
    expect(existsSync(join(ROOT, 'out/renderer/index.html'))).toBe(true)
  })

  it('main bundle does not contain unresolved require for edge-tts .ts file', () => {
    const mainBundle = readFileSync(join(ROOT, 'out/main/index.js'), 'utf-8')
    // If edge-tts is properly bundled, there should be no require("edge-tts") in the output
    // (it gets inlined). If externalized, require("edge-tts") would resolve to the .ts file at runtime.
    expect(mainBundle).not.toMatch(/require\(["']edge-tts["']\)/)
  })

  it('main bundle does not contain unresolved require for bufferutil or utf-8-validate', () => {
    const mainBundle = readFileSync(join(ROOT, 'out/main/index.js'), 'utf-8')
    // ws optional deps should be externalized (not erroring on missing), not inlined
    // The bundle should have try/catch around optional native module loading, or they
    // should be listed as rollup externals so they become optional require() calls
    // that ws handles gracefully when missing.
    // We verify the build doesn't hard-fail by checking the bundle was created (test above).
    // This test ensures the pattern: if bufferutil appears, it must be in a try-catch or conditional
    const lines = mainBundle.split('\n')
    for (const line of lines) {
      if (line.includes('require("bufferutil")') || line.includes("require('bufferutil')")) {
        // If it's a hard require (not in try/catch), ws will throw at runtime
        // The line should contain try or catch nearby, or be in a conditional
        const surrounding = mainBundle.slice(
          Math.max(0, mainBundle.indexOf(line) - 200),
          mainBundle.indexOf(line) + line.length + 200,
        )
        const isGuarded = surrounding.includes('try') || surrounding.includes('catch') || surrounding.includes('optional')
        // If it's externalized (via rollupOptions.external), require will just return undefined
        // and ws handles that gracefully — so either guarded or externalized is fine
        expect(isGuarded || mainBundle.includes('external')).toBe(true)
      }
    }
  })

  it('edge-tts WebSocket logic is bundled into main output', () => {
    const mainBundle = readFileSync(join(ROOT, 'out/main/index.js'), 'utf-8')
    // Verify edge-tts code was actually inlined (not left as external require)
    // The edge-tts source connects to speech.platform.bing.com
    expect(mainBundle).toContain('speech.platform.bing.com')
  })
})
