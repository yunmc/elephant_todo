/**
 * E2E — Important Dates CRUD (D01–D04)
 *
 * Serial tests sharing the same user.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const TITLE = `E2E Birthday ${Date.now()}`

let tokens: { accessToken: string; refreshToken: string }

test.describe.serial('Important Dates Flow', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  test('D01: create important date', async ({ page }) => {
    await page.goto(`${BASE}/important-dates`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('重要日期', { timeout: 8000 })

    // Click add button
    await page.getByRole('button', { name: '+ 添加重要日期' }).click()
    // Wait for modal form to appear
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // Fill title
    await page.getByPlaceholder('如：妈妈的生日').fill(TITLE)

    // Pick a date (30 days from now)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    // Click date picker to open
    const datePicker = page.locator('.n-date-picker')
    await datePicker.click()
    await page.waitForTimeout(300)

    // Type date directly into the input
    const dateInput = datePicker.locator('input')
    await dateInput.fill(futureDate.toISOString().split('T')[0].replace(/-/g, '-'))
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Click "添加"
    await page.getByRole('button', { name: '添加', exact: true }).click()
    await page.waitForTimeout(2000)

    // Verify date card appears
    await expect(page.getByText(TITLE)).toBeVisible({ timeout: 5000 })
    // Should show days countdown
    await expect(page.locator('.countdown').first()).toBeVisible()
  })

  test('D02: edit date', async ({ page }) => {
    await page.goto(`${BASE}/important-dates`)
    await waitForHydration(page)
    await expect(page.getByText(TITLE)).toBeVisible({ timeout: 8000 })

    // Click card to edit
    await page.locator('.date-card').filter({ hasText: TITLE }).click()
    // Wait for edit form to appear
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // Change title
    const titleInput = page.getByPlaceholder('如：妈妈的生日')
    await titleInput.fill(`${TITLE} Edited`)
    await page.getByRole('button', { name: '保存' }).click()
    await page.waitForTimeout(2000)

    // Verify updated title
    await expect(page.getByText(`${TITLE} Edited`)).toBeVisible({ timeout: 5000 })
  })

  test('D03: yearly repeat tag', async ({ page }) => {
    await page.goto(`${BASE}/important-dates`)
    await waitForHydration(page)
    // The date we created defaults to repeat_yearly=true
    // Verify "每年" tag
    await expect(page.locator('.date-tag').getByText('每年').first()).toBeVisible({ timeout: 5000 })
  })

  test('D04: delete date', async ({ page }) => {
    await page.goto(`${BASE}/important-dates`)
    await waitForHydration(page)
    await expect(page.getByText(`${TITLE} Edited`)).toBeVisible({ timeout: 8000 })

    // Click card to open edit modal
    await page.locator('.date-card').filter({ hasText: `${TITLE} Edited` }).click()
    // Wait for edit form to appear
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // Click delete
    await page.getByRole('button', { name: '删除' }).click()
    await page.waitForTimeout(2000)

    // Date should be gone
    await expect(page.getByText(`${TITLE} Edited`)).not.toBeVisible({ timeout: 5000 })
  })
})
