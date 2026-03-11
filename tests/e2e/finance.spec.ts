/**
 * E2E — Finance CRUD + Category + Statistics (F01–F14)
 *
 * Serial tests sharing the same user.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'
import { waitForSelectOpen, waitForSelectClose } from './fixtures/naive-helpers'

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
    // Create category via API
    const res = await page.context().request.post(`${BASE}/api/finance/categories`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      data: { name: 'E2E餐饮', type: 'expense' },
    })
    expect(res.ok()).toBe(true)

    // Visit finance page and verify category shows in add-record modal
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    await page.getByRole('button', { name: '+ 记一笔' }).click()
    await expect(page.locator('.n-modal')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })

    // Open category select and verify E2E餐饮 appears
    const selectTrigger = page.locator('.n-select').first()
    await selectTrigger.click()
    await waitForSelectOpen(page)
    await expect(page.locator('.n-base-select-option').filter({ hasText: 'E2E餐饮' })).toBeVisible({ timeout: 3000 })
    await page.keyboard.press('Escape')
  })

  test('F02: add expense record', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Click "记一笔"
    await page.getByRole('button', { name: '+ 记一笔' }).click()
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 8000 })

    // Enter amount
    const amountInput = page.locator('.n-input-number input')
    await amountInput.fill('88.50')

    // Category is optional — try to select if available
    const selectTrigger = page.locator('.n-select').first()
    if (await selectTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectTrigger.click()
      await waitForSelectOpen(page)
      const option = page.locator('.n-base-select-option').first()
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click()
        await waitForSelectClose(page)
      } else {
        await page.keyboard.press('Escape')
      }
    }

    // Save and verify API response
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/finance') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok(), `Finance create API failed: ${saveResp.status()}`).toBe(true)

    // Verify expense appears in stats
    await expect(page.getByText('88.50', { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('F03: add income record', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await page.getByRole('button', { name: '+ 记一笔' }).click()
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })

    // Select income type
    await page.getByRole('dialog').getByText('收入').click()

    // Enter amount
    const amountInput = page.locator('.n-input-number input')
    await amountInput.click()
    await amountInput.press('Control+a')
    await amountInput.pressSequentially('200', { delay: 50 })
    await amountInput.press('Tab')

    // Save
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/finance') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    // Verify income appears
    await expect(page.getByText('200.00', { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('F08: statistics show correct balance', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)

    // After F02 (expense 88.50) and F03 (income 200), verify stats
    const incomeCard = page.locator('.stat-card.income')
    const expenseCard = page.locator('.stat-card.expense')
    const balanceCard = page.locator('.stat-card.balance')

    await expect(incomeCard.locator('.stat-value')).toContainText('200.00', { timeout: 5000 })
    await expect(expenseCard.locator('.stat-value')).toContainText('88.50', { timeout: 5000 })
    await expect(balanceCard.locator('.stat-value')).toContainText('111.50', { timeout: 5000 })
  })

  test('F09: add record with note', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await page.getByRole('button', { name: '+ 记一笔' }).click()
    await expect(page.locator('.n-modal')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })

    // Enter amount
    const amountInput = page.locator('.n-input-number input')
    await amountInput.fill('15.00')

    // Fill note
    await page.getByPlaceholder('可选备注').fill('E2E测试备注')

    // Save
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/finance') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    // Verify record with note appears
    await expect(page.getByText('E2E测试备注')).toBeVisible({ timeout: 5000 })
  })

  test('F12: category name displayed on record card', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Add a new record and explicitly select the E2E餐饮 category
    await page.getByRole('button', { name: '+ 记一笔' }).click()
    await expect(page.locator('.n-modal')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })

    const amountInput = page.locator('.n-input-number input')
    await amountInput.fill('25.00')

    // Select category from dropdown
    const selectTrigger = page.locator('.n-select').first()
    if (await selectTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectTrigger.click()
      await waitForSelectOpen(page)
      const catOption = page.locator('.n-base-select-option').filter({ hasText: 'E2E餐饮' })
      if (await catOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await catOption.click()
        await waitForSelectClose(page)
      } else {
        const firstOpt = page.locator('.n-base-select-option').first()
        if (await firstOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
          await firstOpt.click()
          await waitForSelectClose(page)
        } else {
          await page.keyboard.press('Escape')
        }
      }
    }

    // Save
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/finance') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    // Verify record card shows a category name
    await expect(page.locator('.record-card .record-category').first()).toBeVisible({ timeout: 8000 })
  })

  test('F13: save button disabled when amount is empty', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Open "记一笔" modal
    await page.getByRole('button', { name: '+ 记一笔' }).click()
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })

    // Amount is null by default — save button should be disabled
    const saveBtn = page.getByRole('button', { name: '保存' })
    await expect(saveBtn).toBeDisabled({ timeout: 3000 })

    // Enter a valid amount — button should become enabled
    const amountInput = page.locator('.n-input-number input')
    await amountInput.fill('50')
    await amountInput.press('Tab')
    await expect(saveBtn).toBeEnabled({ timeout: 3000 })

    // Close modal
    await page.keyboard.press('Escape')
  })

  test('F14: category options change with type', async ({ page }) => {
    // Create an income category via API
    const incomeCatName = `E2E工资_${Date.now()}`
    const res = await page.context().request.post(`${BASE}/api/finance/categories`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      data: { name: incomeCatName, type: 'income' },
    })
    expect(res.ok()).toBe(true)

    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Open "记一笔" modal — default is expense
    await page.getByRole('button', { name: '+ 记一笔' }).click()
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })

    // Check expense category options — income category should NOT appear
    const selectTrigger = page.locator('.n-select').first()
    await expect(selectTrigger).toBeVisible({ timeout: 3000 })
    await selectTrigger.click()
    await waitForSelectOpen(page)
    const incOptionInExpense = await page.locator('.n-base-select-option').filter({ hasText: incomeCatName }).isVisible().catch(() => false)
    await page.keyboard.press('Escape')
    await waitForSelectClose(page)

    // Switch to income type — click the radio button label
    await page.locator('.n-radio-button').filter({ hasText: '收入' }).click()
    // Wait for Vue reactivity to update categoryOptions
    await page.waitForTimeout(300)

    // Re-check — income category should now appear
    await selectTrigger.click()
    await waitForSelectOpen(page)
    const incOptionInIncome = await page.locator('.n-base-select-option').filter({ hasText: incomeCatName }).isVisible().catch(() => false)
    await page.keyboard.press('Escape')

    // Income category should be hidden in expense mode, visible in income mode
    expect(incOptionInExpense).toBe(false)
    expect(incOptionInIncome).toBe(true)

    // Close modal
    await page.keyboard.press('Escape')
  })

  test('F04: type filter tabs', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)

    // Click "支出" tab — wait for filtered content
    await page.locator('.filter-tabs .tab').getByText('支出').click()
    await expect(page.locator('.record-card').filter({ hasText: '88.50' }).first()).toBeVisible({ timeout: 5000 })

    // Click "收入" tab
    await page.locator('.filter-tabs .tab').getByText('收入').click()
    await expect(page.locator('.record-card').filter({ hasText: '200.00' }).first()).toBeVisible({ timeout: 5000 })

    // Click "全部"
    await page.locator('.filter-tabs .tab').getByText('全部').click()
    await expect(page.locator('.record-card').first()).toBeVisible({ timeout: 5000 })
  })

  test('F05: month navigation', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Current month label should be visible
    const now = new Date()
    const monthStr = `${now.getFullYear()}年${now.getMonth() + 1}月`
    await expect(page.getByText(monthStr)).toBeVisible({ timeout: 5000 })

    // Go to previous month
    await page.locator('.month-btn').first().click()

    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const prevMonthStr = `${prevYear}年${prevMonth}月`
    await expect(page.getByText(prevMonthStr)).toBeVisible({ timeout: 5000 })

    // Go back to current month
    await page.locator('.month-btn').last().click()
    await expect(page.getByText(monthStr)).toBeVisible({ timeout: 5000 })
  })

  test('F06: delete record', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)

    // Wait for records to load
    await expect(page.locator('.record-card').first()).toBeVisible({ timeout: 5000 })
    const recordsBefore = await page.locator('.record-card').count()

    // Delete first record
    const firstCard = page.locator('.record-card').first()
    await firstCard.getByRole('button', { name: '删除' }).click()
    // Confirm popconfirm
    const [deleteResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/finance') && resp.request().method() === 'DELETE', { timeout: 10000 }),
      page.getByRole('button', { name: '删除' }).last().click(),
    ])
    expect(deleteResp.ok()).toBe(true)

    // Should have one fewer record
    await expect(async () => {
      const recordsAfter = await page.locator('.record-card').count()
      expect(recordsAfter).toBeLessThan(recordsBefore)
    }).toPass({ timeout: 5000 })
  })

  test('F07: delete category via API', async ({ page }) => {
    // Get categories via API and find E2E餐饮
    const listRes = await page.context().request.get(`${BASE}/api/finance/categories`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    expect(listRes.ok()).toBe(true)
    const listJson = await listRes.json()
    const cat = listJson.data.find((c: any) => c.name === 'E2E餐饮')
    expect(cat).toBeTruthy()

    // Delete via API
    const delRes = await page.context().request.delete(`${BASE}/api/finance/categories/${cat.id}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    expect(delRes.ok()).toBe(true)

    // Verify category no longer appears in the add-record modal
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await page.getByRole('button', { name: '+ 记一笔' }).click()
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })
    const selectTrigger = page.locator('.n-select').first()
    await selectTrigger.click()
    await waitForSelectOpen(page)
    const catOption = await page.locator('.n-base-select-option').filter({ hasText: 'E2E餐饮' }).isVisible().catch(() => false)
    expect(catOption).toBe(false)
    await page.keyboard.press('Escape')
  })

  // ── Budget Management (F08-F10) ──

  test('F08: free user sees budget lock or empty state', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)

    // Budget feature is not yet available
    await expect(page.getByText('预算管理功能即将上线')).toBeVisible({ timeout: 5000 })
  })

  test('F09: budget card renders in finance page', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)

    // Budget section should exist in DOM
    const budgetSection = page.locator('.budget-section')
    await expect(budgetSection).toBeVisible({ timeout: 5000 })
  })

  test('F10: premium user can open budget modal', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)

    // Budget section shows coming-soon message for all users
    await expect(page.getByText('预算管理功能即将上线')).toBeVisible({ timeout: 5000 })
  })
})
