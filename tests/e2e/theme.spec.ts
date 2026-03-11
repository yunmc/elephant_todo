/**
 * E2E — Theme Switching & Persistence (TH01–TH06)
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

/** Helper: wait for theme attribute to have expected value */
async function waitForTheme(page: import('@playwright/test').Page, expected: 'dark' | 'light') {
  await expect(async () => {
    const theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe(expected)
  }).toPass({ timeout: 3000 })
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

    await page.evaluate(() => localStorage.removeItem('elephant-theme'))

    await page.click('button:has-text("深色")')
    await waitForTheme(page, 'dark')

    const theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('dark')
    expect(theme.dataAppTheme).toBe('dark')
    expect(theme.hasDarkClass).toBe(true)

    const darkBtn = page.locator('button:has-text("深色")')
    await expect(darkBtn).toHaveClass(/active/)
  })

  test('TH02: switching to light theme applies light styles', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("深色")')
    await waitForTheme(page, 'dark')

    await page.click('button:has-text("浅色")')
    await waitForTheme(page, 'light')

    const theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('light')
    expect(theme.dataAppTheme).toBe('light')
    expect(theme.hasDarkClass).toBe(false)

    const lightBtn = page.locator('button:has-text("浅色")')
    await expect(lightBtn).toHaveClass(/active/)
  })

  test('TH03: dark theme persists after switching tabs', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("深色")')
    await waitForTheme(page, 'dark')

    // Navigate to home tab
    await page.evaluate(() => (document.querySelector('.nav-item') as HTMLElement)?.click())
    await page.waitForURL(/\/$/, { timeout: 5000 })

    const homeTheme = await getHtmlTheme(page)
    expect(homeTheme.dataTheme).toBe('dark')
    expect(homeTheme.dataAppTheme).toBe('dark')
    expect(homeTheme.hasDarkClass).toBe(true)

    // Navigate back to settings
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 5000 })

    const settingsTheme = await getHtmlTheme(page)
    expect(settingsTheme.dataTheme).toBe('dark')
    expect(settingsTheme.hasDarkClass).toBe(true)

    const darkBtn = page.locator('button:has-text("深色")')
    await expect(darkBtn).toHaveClass(/active/)
  })

  test('TH04: light theme persists after switching tabs', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("深色")')
    await waitForTheme(page, 'dark')
    await page.click('button:has-text("浅色")')
    await waitForTheme(page, 'light')

    // Navigate to ideas tab
    await page.evaluate(() => (document.querySelectorAll('.nav-item')[1] as HTMLElement)?.click())
    await page.waitForURL(/\/ideas/, { timeout: 5000 })

    const ideasTheme = await getHtmlTheme(page)
    expect(ideasTheme.dataTheme).toBe('light')
    expect(ideasTheme.dataAppTheme).toBe('light')
    expect(ideasTheme.hasDarkClass).toBe(false)

    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("浅色")')).toBeVisible({ timeout: 5000 })

    const settingsTheme = await getHtmlTheme(page)
    expect(settingsTheme.dataTheme).toBe('light')
    expect(settingsTheme.hasDarkClass).toBe(false)

    const lightBtn = page.locator('button:has-text("浅色")')
    await expect(lightBtn).toHaveClass(/active/)
  })

  test('TH05: dark theme persists after re-tapping the same tab', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("深色")')
    await waitForTheme(page, 'dark')

    // Navigate to 待办
    await page.evaluate(() => (document.querySelector('.nav-item') as HTMLElement)?.click())
    await page.waitForURL(/\/$/, { timeout: 5000 })

    let theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('dark')
    expect(theme.hasDarkClass).toBe(true)

    // Re-tap the same tab
    await page.evaluate(() => (document.querySelector('.nav-item') as HTMLElement)?.click())

    // Verify dark theme is STILL correct
    await waitForTheme(page, 'dark')
    theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('dark')
    expect(theme.dataAppTheme).toBe('dark')
    expect(theme.hasDarkClass).toBe(true)
  })

  test('TH06: dark theme persists after full page reload', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("深色")')
    await waitForTheme(page, 'dark')

    let theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('dark')

    // Full page reload
    await page.reload()
    await waitForHydration(page)
    await expect(page.locator('button:has-text("深色")')).toBeVisible({ timeout: 10000 })

    // Verify dark theme persists after reload
    await waitForTheme(page, 'dark')
    theme = await getHtmlTheme(page)
    expect(theme.dataTheme).toBe('dark')
    expect(theme.dataAppTheme).toBe('dark')
    expect(theme.hasDarkClass).toBe(true)

    const darkBtn = page.locator('button:has-text("深色")')
    await expect(darkBtn).toHaveClass(/active/)
  })
})
