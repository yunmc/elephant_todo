/**
 * E2E — Finance CRUD + Category + Statistics (F01–F06)
 *
 * Serial tests sharing the same user.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

let tokens: { accessToken: string; refreshToken: string }

test.describe.serial('Finance Flow', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  test('F01: create expense category', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Open category management
    await page.getByText('管理分类').click()
    // Wait for modal form to appear
    await expect(page.getByPlaceholder('新分类名称')).toBeVisible({ timeout: 5000 })

    // Add a new category
    await page.getByPlaceholder('新分类名称').fill('E2E餐饮')
    await page.getByRole('button', { name: '添加' }).click()
    await page.waitForTimeout(1000)

    // Verify category appears
    await expect(page.getByText('E2E餐饮')).toBeVisible({ timeout: 3000 })

    // Close modal
    await page.keyboard.press('Escape')
  })

  test('F02: add expense record', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Click "记一笔"
    await page.getByRole('button', { name: '+ 记一笔' }).click()
    // Wait for modal form to appear
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })

    // Select expense type (default), enter amount
    const amountInput = page.locator('.n-input-number input')
    await amountInput.fill('88.50')

    // Category is optional — try to select if available
    const selectTrigger = page.locator('.n-select').first()
    if (await selectTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectTrigger.click()
      await page.waitForTimeout(500)
      const option = page.locator('.n-base-select-option').first()
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click()
      } else {
        await page.keyboard.press('Escape')
      }
    }

    // Save
    await page.getByRole('button', { name: '保存' }).click()
    await page.waitForTimeout(2000)

    // Verify expense appears in stats
    await expect(page.getByText('88.50', { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('F03: add income record', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await page.getByRole('button', { name: '+ 记一笔' }).click()
    // Wait for modal form to appear
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })

    // Select income type first via the label text (click the wrapper, not the hidden radio input)
    await page.getByRole('dialog').getByText('收入').click()
    await page.waitForTimeout(500)

    // Enter amount using keyboard input (more reliable with NaiveUI n-input-number)
    const amountInput = page.locator('.n-input-number input')
    await amountInput.click()
    await amountInput.press('Control+a')
    await amountInput.pressSequentially('200', { delay: 50 })
    // Tab out to trigger NaiveUI value commit
    await amountInput.press('Tab')
    await page.waitForTimeout(500)

    // Save
    await page.getByRole('button', { name: '保存' }).click()
    await page.waitForTimeout(2000)

    // Verify income appears
    await expect(page.getByText('200.00', { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('F04: type filter tabs', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    // Click "支出" tab
    await page.locator('.filter-tabs .tab').getByText('支出').click()
    await page.waitForTimeout(1000)
    // Should show expense records
    await expect(page.getByText('88.50', { exact: true })).toBeVisible({ timeout: 3000 })

    // Click "收入" tab
    await page.locator('.filter-tabs .tab').getByText('收入').click()
    await page.waitForTimeout(1000)
    // Should show income records
    await expect(page.getByText('200.00', { exact: true })).toBeVisible({ timeout: 3000 })

    // Click "全部"
    await page.locator('.filter-tabs .tab').getByText('全部').click()
    await page.waitForTimeout(500)
  })

  test('F05: month navigation', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Current month label should be visible
    const now = new Date()
    const monthStr = `${now.getFullYear()}年${now.getMonth() + 1}月`
    await expect(page.getByText(monthStr)).toBeVisible({ timeout: 3000 })

    // Go to previous month
    await page.locator('.month-btn').first().click()
    await page.waitForTimeout(1000)

    // Go back to current month
    await page.locator('.month-btn').last().click()
    await page.waitForTimeout(1000)
    await expect(page.getByText(monthStr)).toBeVisible()
  })

  test('F06: delete record', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    // Count records before
    const recordsBefore = await page.locator('.record-card').count()

    // Delete first record
    const firstCard = page.locator('.record-card').first()
    await firstCard.getByRole('button', { name: '删除' }).click()
    // Confirm popconfirm
    await page.getByRole('button', { name: '删除' }).last().click()
    await page.waitForTimeout(1500)

    // Should have one fewer record
    const recordsAfter = await page.locator('.record-card').count()
    expect(recordsAfter).toBeLessThan(recordsBefore)
  })
})
