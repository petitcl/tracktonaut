import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })

  test('login page displays Google sign-in button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('text=Sign in with Google')).toBeVisible()
  })

  test('protected routes redirect to login when not authenticated', async ({ page }) => {
    const protectedRoutes = ['/capture', '/catalog', '/metrics', '/settings', '/profile']

    for (const route of protectedRoutes) {
      await page.goto(route)
      await expect(page).toHaveURL('/login')
    }
  })
})
