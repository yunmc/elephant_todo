/**
 * E2E — Ideas CRUD + Link/Convert (I01–I05)
 *
 * Serial tests sharing the same user.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const CONTENT = `E2E Idea ${Date.now()}`

let tokens: { accessToken: string; refreshToken: string }

test.describe.serial('Ideas Flow', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  test('I01: create idea via quick-add', async ({ page }) => {
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('随手记', { timeout: 8000 })

    // Open quick-add (dispatchEvent bypasses DevTools overlay on bottom nav)
    await page.locator('.nav-add').waitFor({ state: 'visible' })
    await page.locator('.nav-add').dispatchEvent('click')
    // Wait for modal content to appear
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 8000 })

    // Type and save as idea
    await page.getByPlaceholder('输入内容...').fill(CONTENT)
    await page.getByRole('button', { name: '保存为随手记' }).click()

    // Navigate to ideas and verify
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await expect(page.getByText(CONTENT)).toBeVisible({ timeout: 5000 })
  })

  test('I02: edit idea content', async ({ page }) => {
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await page.getByText(CONTENT).click()
    await expect(page.getByPlaceholder('记录你的想法...')).toBeVisible({ timeout: 5000 })

    // Edit content
    const textarea = page.getByPlaceholder('记录你的想法...')
    await textarea.fill(`${CONTENT} Updated`)
    await page.locator('.action-btn.save').click()
    await page.waitForTimeout(1000)

    // Go back and verify
    await page.locator('.back-btn').click()
    await expect(page.getByText(`${CONTENT} Updated`)).toBeVisible({ timeout: 5000 })
  })

  test('I03: convert idea to todo', async ({ page }) => {
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await page.getByText(`${CONTENT} Updated`).click()
    await expect(page.getByText('关联待办')).toBeVisible({ timeout: 5000 })

    // Click "转为待办"
    await page.getByText('转为待办').click()
    await page.waitForTimeout(2000)

    // Should now show a linked todo
    await expect(page.locator('.linked-todo')).toBeVisible({ timeout: 5000 })
  })

  test('I04: unlink idea from todo', async ({ page }) => {
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await page.getByText(`${CONTENT} Updated`).first().click()
    await expect(page.locator('.linked-todo')).toBeVisible({ timeout: 5000 })

    // Click unlink button
    await page.locator('.unlink-btn').click()
    await page.waitForTimeout(2000)

    // Should show "转为待办" again
    await expect(page.getByText('转为待办')).toBeVisible({ timeout: 8000 })
  })

  test('I05: delete idea', async ({ page }) => {
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await page.getByText(`${CONTENT} Updated`).click()
    await expect(page.getByText('删除这条随手记')).toBeVisible({ timeout: 5000 })

    await page.getByText('删除这条随手记').click()
    // Confirm
    await page.getByRole('button', { name: '删除', exact: true }).click()
    await expect(page).toHaveURL(/\/ideas/, { timeout: 8000 })
    await expect(page.getByText(`${CONTENT} Updated`)).not.toBeVisible({ timeout: 3000 })
  })
})
