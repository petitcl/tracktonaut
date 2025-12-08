import { test, expect } from '@playwright/test'

/**
 * NOTE: These tests require authentication.
 *
 * To run these tests with authentication:
 * 1. Run: npx playwright codegen http://localhost:3000
 * 2. Sign in with Google
 * 3. Save the authenticated state to auth.json
 * 4. Update playwright.config.ts with: use: { storageState: 'auth.json' }
 */

test.describe('Complete User Flow', () => {
  test.skip('new user onboarding: catalog → capture → dashboard', async ({ page }) => {
    // Step 1: Start on dashboard (empty state)
    await page.goto('/')
    await expect(page.locator('h1:text("Dashboard")')).toBeVisible()

    // Should show empty state
    await expect(page.locator('text=No metrics yet')).toBeVisible()

    // Step 2: Browse catalog
    await page.click('text=Browse Catalog')
    await expect(page).toHaveURL('/catalog')

    // Should see catalog metrics
    await expect(page.locator('[data-testid="catalog-metric"]').first()).toBeVisible()

    // Install a metric (e.g., Sleep Hours)
    await page.click('button:text("Install"):near(:text("Sleep Hours"))')

    // Wait for installation
    await page.waitForTimeout(1000)

    // Step 3: Go to capture page
    await page.click('text=Capture')
    await expect(page).toHaveURL('/capture')

    // Should see the installed metric
    await expect(page.locator('text=Sleep Hours')).toBeVisible()

    // Fill in the metric value
    await page.fill('input[type="number"]', '7.5')

    // Submit the daily check-in
    await page.click('button:text("Submit")')

    // Should redirect to dashboard
    await expect(page).toHaveURL('/')

    // Step 4: Verify dashboard shows data
    await expect(page.locator('text=Sleep Hours')).toBeVisible()
    await expect(page.locator('text=7.5')).toBeVisible()
  })

  test.skip('daily check-in flow', async ({ page }) => {
    await page.goto('/capture')

    // Check completion percentage is visible
    await expect(page.locator('text=Completion')).toBeVisible()

    // Fill in multiple metrics
    const metrics = await page.locator('[data-testid="metric-input"]')
    const count = await metrics.count()

    if (count > 0) {
      // Fill first metric (assuming it's a rating or number)
      await metrics.first().click()

      // Save as draft
      await page.click('button:text("Save Draft")')
      await expect(page.locator('text=Draft saved successfully')).toBeVisible()

      // Complete and submit
      await page.click('button:text("Submit")')

      // Should redirect to dashboard
      await expect(page).toHaveURL('/')
    }
  })

  test.skip('metrics management flow', async ({ page }) => {
    await page.goto('/metrics')

    // Should see metrics list
    await expect(page.locator('h2:text("Active Metrics")')).toBeVisible()

    // Toggle a metric to required
    const toggleButton = page.locator('button:text("Make Required")').first()
    if (await toggleButton.isVisible()) {
      await toggleButton.click()
      await expect(page.locator('button:text("Make Optional")')).toBeVisible()
    }

    // Archive a metric
    const archiveButton = page.locator('button:text("Archive")').first()
    if (await archiveButton.isVisible()) {
      await archiveButton.click()

      // Should see archived section
      await expect(page.locator('text=Archived Metrics')).toBeVisible()

      // Expand archived section
      await page.click('button:has-text("Archived Metrics")')

      // Unarchive it
      await page.click('button:text("Unarchive")').first()

      // Should be back in active metrics
      await page.waitForTimeout(500)
    }
  })

  test.skip('settings management flow', async ({ page }) => {
    await page.goto('/settings')

    // Change timezone
    await page.selectOption('select', 'America/New_York')
    await expect(page.locator('text=Timezone updated successfully')).toBeVisible()

    // Change language
    await page.click('button:text("Español")')
    await expect(page.locator('text=Language updated successfully')).toBeVisible()

    // Enable reminders
    const reminderToggle = page.locator('button:has-text("Enable Reminders")').first()
    await reminderToggle.click()

    // Set reminder time
    await page.fill('input[type="time"]', '20:00')
    await expect(page.locator('text=Reminder settings updated successfully')).toBeVisible()
  })

  test.skip('profile management flow', async ({ page }) => {
    await page.goto('/profile')

    // Edit display name
    await page.click('button:text("Edit")')
    await page.fill('input[id="display-name"]', 'Test User')
    await page.click('button:text("Save")')

    await expect(page.locator('text=Display name updated successfully')).toBeVisible()
    await expect(page.locator('text=Test User')).toBeVisible()
  })
})
