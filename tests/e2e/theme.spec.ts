/**
 * E2E — Theme Switching & Persistence (TH01–TH05)
 *
 * Serial tests sharing the same user.
 * Uses registerOnce() pattern instead of env vars.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

let tokens: { accessToken: string; refreshToken: string }

/**
 * Helper: get current theme from <html> element
 */
async function getHtmlTheme(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute('data-theme'),
    dataAppTheme: document.documentElement.getAttribute('data-app-theme'),
    hasDarkClass: document.documentElement.classList.contains('dark'),
  }))
}

test.describe.serial('Theme Switching', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  test('TH01: switching to dark theme applies dark styles', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })

    // Clear theme before test
    await page.evaluate(() => localStorage.removeItem('elephant-theme'))

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
  })

  test('TH02: switching to light theme applies light styles', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })

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

  test('TH03: dark theme persists after switching tabs', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })

    // Switch to dark
    await page.click('button:has-text("深色")')
    await page.waitForTimeout(500)

    // Navigate to 待办 (home tab)
    await page.locator('.nav-item').filter({ hasText: '待办' }).dispatchEvent('click')
    await page.waitForURL(/\/$/, { timeout: 5000 })
    await page.waitForTimeout(500)

    // Verify dark theme is still applied on the home page
    const homeTheme = await getHtmlTheme(page)
    expect(homeTheme.dataTheme).toBe('dark')
    expect(homeTheme.dataAppTheme).toBe('dark')
    expect(homeTheme.hasDarkClass).toBe(true)

    // Navigate back to settings via more → settings
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
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

  test('TH04: light theme persists after switching tabs', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })

    // Switch to dark first, then to light
    await page.click('button:has-text("深色")')
    await page.waitForTimeout(300)
    await page.click('button:has-text("浅色")')
    await page.waitForTimeout(500)

    // Navigate to 随手记 tab
    await page.locator('.nav-item').filter({ hasText: '随手记' }).dispatchEvent('click')
    await page.waitForURL(/\/ideas/, { timeout: 5000 })
    await page.waitForTimeout(500)

    // Verify light theme on ideas page
    const ideasTheme = await getHtmlTheme(page)
    expect(ideasTheme.dataTheme).toBe('light')
    expect(ideasTheme.dataAppTheme).toBe('light')
    expect(ideasTheme.hasDarkClass).toBe(false)

    // Navigate back to settings
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
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

  test('TH05: dark theme persists after re-tapping the same tab', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })

    // Switch to dark
    await page.click('button:has-text("深色")')
    await page.waitForTimeout(500)

    // Navigate to 待办
    await page.locator('.nav-item').filter({ hasText: '待办' }).dispatchEvent('click')
    await page.waitForURL(/\/$/, { timeout: 5000 })
    await page.waitForTimeout(500)

    // Verify dark on 待办
    let theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('dark')
    expect(theme.hasDarkClass).toBe(true)

    // Re-tap the same 待办 tab (same-route click)
    await page.locator('.nav-item').filter({ hasText: '待办' }).dispatchEvent('click')
    await page.waitForTimeout(1000)

    // Verify dark theme is STILL correct after same-tab re-tap
    theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('dark')
    expect(theme.dataAppTheme).toBe('dark')
    expect(theme.hasDarkClass).toBe(true)
  })
})
