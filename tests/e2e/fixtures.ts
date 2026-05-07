import { test as base, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from '@playwright/test'
import { resolve } from 'path'

type Fixtures = {
  electronApp: ElectronApplication
  firstWindow: Page
}

export const test = base.extend<Fixtures>({
  electronApp: async ({}, use) => {
    const appPath = resolve(__dirname, '../../')
    const app = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    })
    await use(app)
    await app.close()
  },

  firstWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await use(window)
  },
})

export { expect } from '@playwright/test'
