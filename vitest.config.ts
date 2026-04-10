import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
    testTimeout: 10_000,
    environmentMatchGlobs: [
      ['tests/integration/timeline-editor*', 'jsdom'],
      ['tests/integration/script-editor*', 'jsdom'],
      ['tests/integration/view-mode*', 'jsdom'],
    ],
  },
})
