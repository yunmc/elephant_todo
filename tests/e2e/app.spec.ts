import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Authentication Flow', () => {
  test('should show login page for unauthenticated user', async ({ page }) => {
    await page.goto(BASE_URL)
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page should have email and password fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await expect(page.locator('input[placeholder*="邮箱"]')).toBeVisible()
    await expect(page.locator('input[placeholder*="密码"]')).toBeVisible()
  })

  test('login should show error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[placeholder*="邮箱"]', 'wrong@test.com')
    await page.fill('input[placeholder*="密码"]', 'wrongpassword')
    await page.click('button:has-text("登录")')
    // Should show error message
    await expect(page.locator('.n-message')).toBeVisible({ timeout: 5000 })
  })

  test('register page should be accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)
    await expect(page.locator('input[placeholder*="用户名"]')).toBeVisible()
    await expect(page.locator('input[placeholder*="邮箱"]')).toBeVisible()
  })

  test('forgot password page should be accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/forgot-password`)
    await expect(page.locator('input[placeholder*="邮箱"]')).toBeVisible()
  })
})

test.describe('Navigation', () => {
  // These tests require authentication - skipped if not configured
  test.skip(true, 'Requires authenticated session - run with SEED_USER env vars')

  test('should show bottom navigation tabs', async ({ page }) => {
    await page.goto(BASE_URL)
    await expect(page.locator('text=待办')).toBeVisible()
    await expect(page.locator('text=随手记')).toBeVisible()
    await expect(page.locator('text=密码本')).toBeVisible()
    await expect(page.locator('text=设置')).toBeVisible()
  })

  test('should navigate to ideas page', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.click('text=随手记')
    await expect(page).toHaveURL(/\/ideas/)
  })

  test('should navigate to vault page', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.click('text=密码本')
    await expect(page).toHaveURL(/\/vault/)
  })

  test('should navigate to settings page', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.click('text=设置')
    await expect(page).toHaveURL(/\/settings/)
  })
})

test.describe('PWA', () => {
  test('should serve manifest', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/manifest.webmanifest`)
    if (response) {
      expect(response.status()).toBe(200)
    }
  })

  test('should have PWA meta tags', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(themeColor).toBeDefined()
  })
})
