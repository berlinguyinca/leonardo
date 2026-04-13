import { test, expect } from './fixtures'

test.describe('App launch', () => {
  test('opens with Leonardo window title', async ({ firstWindow }) => {
    const title = await firstWindow.title()
    expect(title.toLowerCase()).toContain('leonardo')
  })

  test('main window has minimum dimensions', async ({ electronApp }) => {
    const window = await electronApp.firstWindow()
    const { width, height } = await window.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }))
    expect(width).toBeGreaterThanOrEqual(800)
    expect(height).toBeGreaterThanOrEqual(600)
  })

  test('project home screen renders', async ({ firstWindow }) => {
    // Wait for either Create Project button or a project card to appear
    const createBtn = firstWindow.getByText(/create.*project/i)
    await expect(createBtn).toBeVisible({ timeout: 10_000 })
  })
})
