import { test, expect } from './fixtures'

test.describe('Project CRUD', () => {
  test('create a new project via wizard', async ({ firstWindow }) => {
    // Click the Create Project button
    const createBtn = firstWindow.getByText(/create.*project/i)
    await createBtn.click()

    // Fill in project name
    const nameInput = firstWindow.locator('input[placeholder*="name" i], input[type="text"]').first()
    await nameInput.fill('Test Project E2E')

    // Click create/confirm
    const confirmBtn = firstWindow.getByText(/create|confirm|save/i).last()
    await confirmBtn.click()

    // Verify workspace loads (toolbar should show presets)
    await expect(firstWindow.getByText(/compose|record/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('project appears in project list after creation', async ({ firstWindow }) => {
    // Navigate to project home (click LEONARDO brand)
    const brand = firstWindow.getByText('LEONARDO')
    if (await brand.isVisible()) {
      await brand.click()
    }

    // Verify at least one project card exists
    await expect(firstWindow.locator('.project-card, [data-testid="project-card"]').first())
      .toBeVisible({ timeout: 10_000 })
  })
})
