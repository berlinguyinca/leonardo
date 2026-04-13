import { test, expect } from './fixtures'

test.describe('Recording flow', () => {
  test('can navigate to recording view', async ({ firstWindow }) => {
    // First create or open a project
    const createBtn = firstWindow.getByText(/create.*project/i)
    if (await createBtn.isVisible()) {
      await createBtn.click()
      const nameInput = firstWindow.locator('input[placeholder*="name" i], input[type="text"]').first()
      await nameInput.fill('Recording Test')
      const confirmBtn = firstWindow.getByText(/create|confirm|save/i).last()
      await confirmBtn.click()
    }

    // Switch to Record mode
    const recordTab = firstWindow.getByText(/record/i).first()
    await recordTab.click()

    // Recording browser or controls should appear
    await expect(
      firstWindow.locator('.recording-browser, .recording-controls, [data-testid="recording-view"]').first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('workspace toolbar shows all preset tabs', async ({ firstWindow }) => {
    // Verify all 5 preset tabs exist
    const tabs = ['Record', 'Compose', 'Script', 'Effects', 'Export']
    for (const tab of tabs) {
      await expect(firstWindow.getByText(tab, { exact: false }).first()).toBeVisible({ timeout: 5_000 })
    }
  })

  test('can switch between workspace presets', async ({ firstWindow }) => {
    // Click through each preset tab
    const composeTab = firstWindow.getByText(/compose/i).first()
    await composeTab.click()

    // Verify compose view elements appear
    await expect(
      firstWindow.locator('.timeline-container, .panel-system, .panel-placeholder').first()
    ).toBeVisible({ timeout: 5_000 })
  })
})
