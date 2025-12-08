import { test, expect } from '@playwright/test'

/**
 * NOTE: These tests require authentication.
 *
 * To run these tests, you need to:
 * 1. Sign in manually once and save the authenticated state
 * 2. Use Playwright's storageState to reuse the auth session
 *
 * Example setup:
 * npx playwright codegen http://localhost:3000 --save-storage=auth.json
 *
 * Then update playwright.config.ts to use storageState: 'auth.json'
 */

test.describe('Navigation', () => {
  test.skip('should navigate between all main pages', async ({ page }) => {
    // Start on dashboard
    await page.goto('/')
    await expect(page.locator('h1:text("Dashboard")')).toBeVisible()

    // Navigate to Capture
    await page.click('text=Capture')
    await expect(page).toHaveURL('/capture')

    // Navigate to Catalog
    await page.click('text=Catalog')
    await expect(page).toHaveURL('/catalog')
    await expect(page.locator('h1:text("Metrics Catalog")')).toBeVisible()

    // Navigate to Metrics
    await page.click('text=Metrics')
    await expect(page).toHaveURL('/metrics')
    await expect(page.locator('h1:text("Manage Metrics")')).toBeVisible()

    // Navigate to Settings
    await page.click('text=Settings')
    await expect(page).toHaveURL('/settings')
    await expect(page.locator('h1:text("Settings")')).toBeVisible()

    // Navigate to Profile
    await page.click('text=Profile')
    await expect(page).toHaveURL('/profile')
    await expect(page.locator('h1:text("Profile")')).toBeVisible()

    // Back to Dashboard
    await page.click('text=Dashboard')
    await expect(page).toHaveURL('/')
  })

  test.skip('mobile navigation menu works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/')

    // Mobile menu should be hidden initially
    await expect(page.locator('nav a:text("Dashboard")').last()).not.toBeVisible()

    // Click hamburger menu
    await page.click('nav button[aria-label="Menu"]')

    // Menu should be visible
    await expect(page.locator('nav a:text("Dashboard")').last()).toBeVisible()

    // Click a menu item
    await page.click('nav a:text("Capture")')
    await expect(page).toHaveURL('/capture')
  })
})
