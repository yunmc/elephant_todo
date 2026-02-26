import { test, expect, Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const TEST_EMAIL = process.env.TEST_EMAIL || ''
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''

/**
 * Helper: login via API and set auth cookies, then navigate to settings
 */
async function loginAndGoToSettings(page: Page) {
  // Login via API to avoid UI flakiness
  const resp = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
  const body = await resp.json()
  if (!body.success) throw new Error(`Login failed: ${JSON.stringify(body)}`)

  const { accessToken, refreshToken } = body.data
  // Set auth cookies so the app recognizes the session
  await page.context().addCookies([
    { name: 'accessToken', value: accessToken, url: BASE_URL },
    { name: 'refreshToken', value: refreshToken, url: BASE_URL },
  ])

  // Navigate directly to settings
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' })
  // Wait for theme buttons to appear (inside ClientOnly)
  await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })
}

/**
 * Helper: get current theme from <html> element
 */
async function getHtmlTheme(page: Page) {
  return page.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute('data-theme'),
    dataAppTheme: document.documentElement.getAttribute('data-app-theme'),
    hasDarkClass: document.documentElement.classList.contains('dark'),
  }))
}

test.describe('Theme Switching', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Requires TEST_EMAIL and TEST_PASSWORD env vars')

  test.beforeEach(async ({ page }) => {
    // Clear theme localStorage before each test
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => localStorage.removeItem('elephant-theme'))
  })

  test('switching to dark theme applies dark styles', async ({ page }) => {
    await loginAndGoToSettings(page)

    // Click "深色" button
    await page.click('button:has-text("深色")')
    await page.waitForTimeout(500)

    // Verify dark theme is applied on <html>
    const theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('dark')
    expect(theme.dataAppTheme).toBe('dark')
    expect(theme.hasDarkClass).toBe(true)

    // Verify the "深色" button is highlighted (type=primary)
    const darkBtn = page.locator('button:has-text("深色")')
    await expect(darkBtn).toHaveClass(/n-button--primary-type/)

    // Verify background color changed (dark theme uses dark background)
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
    })
    expect(bgColor).toBeTruthy()
  })

  test('switching to light theme applies light styles', async ({ page }) => {
    await loginAndGoToSettings(page)

    // First switch to dark
    await page.click('button:has-text("深色")')
    await page.waitForTimeout(300)

    // Then switch to light
    await page.click('button:has-text("浅色")')
    await page.waitForTimeout(500)

    // Verify light theme is applied on <html>
    const theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('light')
    expect(theme.dataAppTheme).toBe('light')
    expect(theme.hasDarkClass).toBe(false)

    // Verify the "浅色" button is highlighted
    const lightBtn = page.locator('button:has-text("浅色")')
    await expect(lightBtn).toHaveClass(/n-button--primary-type/)
  })

  test('dark theme persists after switching tabs', async ({ page }) => {
    await loginAndGoToSettings(page)

    // Switch to dark
    await page.click('button:has-text("深色")')
    await page.waitForTimeout(500)

    // Navigate to 待办 (home tab)
    await page.click('text=待办')
    await page.waitForURL(/\/$/, { timeout: 5000 })
    await page.waitForTimeout(500)

    // Verify dark theme is still applied on the home page
    const homeTheme = await getHtmlTheme(page)
    expect(homeTheme.dataTheme).toBe('dark')
    expect(homeTheme.dataAppTheme).toBe('dark')
    expect(homeTheme.hasDarkClass).toBe(true)

    // Navigate back to settings
    await page.click('text=设置')
    await page.waitForURL(/\/settings/, { timeout: 5000 })
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Verify theme is still dark on settings page
    const settingsTheme = await getHtmlTheme(page)
    expect(settingsTheme.dataTheme).toBe('dark')
    expect(settingsTheme.hasDarkClass).toBe(true)

    // Verify dark button is still highlighted
    const darkBtn = page.locator('button:has-text("深色")')
    await expect(darkBtn).toHaveClass(/n-button--primary-type/)
  })

  test('light theme persists after switching tabs', async ({ page }) => {
    await loginAndGoToSettings(page)

    // Switch to dark first, then to light
    await page.click('button:has-text("深色")')
    await page.waitForTimeout(300)
    await page.click('button:has-text("浅色")')
    await page.waitForTimeout(500)

    // Navigate to 随手记 tab
    await page.click('text=随手记')
    await page.waitForURL(/\/ideas/, { timeout: 5000 })
    await page.waitForTimeout(500)

    // Verify light theme on ideas page
    const ideasTheme = await getHtmlTheme(page)
    expect(ideasTheme.dataTheme).toBe('light')
    expect(ideasTheme.dataAppTheme).toBe('light')
    expect(ideasTheme.hasDarkClass).toBe(false)

    // Navigate back to settings
    await page.click('text=设置')
    await page.waitForURL(/\/settings/, { timeout: 5000 })
    await expect(page.locator('button:has-text("浅色")')).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)

    // Verify light still applied
    const settingsTheme = await getHtmlTheme(page)
    expect(settingsTheme.dataTheme).toBe('light')
    expect(settingsTheme.hasDarkClass).toBe(false)

    // Verify light button highlighted
    const lightBtn = page.locator('button:has-text("浅色")')
    await expect(lightBtn).toHaveClass(/n-button--primary-type/)
  })

  test('dark theme persists after re-tapping the same tab', async ({ page }) => {
    await loginAndGoToSettings(page)

    // Switch to dark
    await page.click('button:has-text("深色")')
    await page.waitForTimeout(500)

    // Navigate to 待办
    await page.click('text=待办')
    await page.waitForURL(/\/$/, { timeout: 5000 })
    await page.waitForTimeout(500)

    // Verify dark on 待办
    let theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('dark')
    expect(theme.hasDarkClass).toBe(true)

    // Re-tap the same 待办 tab (same-route click)
    await page.click('text=待办')
    await page.waitForTimeout(1000)

    // Verify dark theme is STILL correct after same-tab re-tap
    theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('dark')
    expect(theme.dataAppTheme).toBe('dark')
    expect(theme.hasDarkClass).toBe(true)
  })
})
