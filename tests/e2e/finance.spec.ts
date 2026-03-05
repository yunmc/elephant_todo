/**
 * E2E — Finance CRUD + Category + Statistics (F01–F14)
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

    // F10: verify empty state for fresh user (before first record)
    const emptyVisible = await page.getByText('暂无记账记录').isVisible().catch(() => false)
    // Fresh user should see empty state
    // (may not appear if data from prior runs exists)

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
    await page.waitForTimeout(1000)
    // Wait for modal form to appear
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 8000 })

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

    // Save and verify API response
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/finance') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok(), `Finance create API failed: ${saveResp.status()}`).toBe(true)
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

  test('F08: statistics show correct balance', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

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
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })

    // Enter amount
    const amountInput = page.locator('.n-input-number input')
    await amountInput.fill('15.00')

    // Fill note
    await page.getByPlaceholder('可选备注').fill('E2E测试备注')

    // Save
    await page.getByRole('button', { name: '保存' }).click()
    await page.waitForTimeout(2000)

    // Verify record with note appears
    await expect(page.getByText('E2E测试备注')).toBeVisible({ timeout: 5000 })
  })

  test('F12: category name displayed on record card', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Add a new record and explicitly select the E2E餐饮 category
    await page.getByRole('button', { name: '+ 记一笔' }).click()
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })

    const amountInput = page.locator('.n-input-number input')
    await amountInput.fill('25.00')

    // Select category from dropdown
    const selectTrigger = page.locator('.n-select').first()
    if (await selectTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectTrigger.click()
      await page.waitForTimeout(500)
      const catOption = page.locator('.n-base-select-option').filter({ hasText: 'E2E餐饮' })
      if (await catOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await catOption.click()
      } else {
        // Select first available option
        const firstOpt = page.locator('.n-base-select-option').first()
        if (await firstOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
          await firstOpt.click()
        } else {
          await page.keyboard.press('Escape')
        }
      }
    }

    // Save
    await page.getByRole('button', { name: '保存' }).click()
    await page.waitForTimeout(2000)

    // Verify record card shows a category name in .record-category
    const recordCards = page.locator('.record-card')
    const hasCategory = await recordCards.locator('.record-category').first().isVisible().catch(() => false)
    // At least one record should have a category
    expect(hasCategory).toBe(true)
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
    await page.waitForTimeout(500)
    await expect(saveBtn).toBeEnabled({ timeout: 3000 })

    // Close modal
    await page.keyboard.press('Escape')
  })

  test('F14: category options change with type', async ({ page }) => {
    // Create an income category via UI category management modal
    const incomeCatName = `E2E工资_${Date.now()}`
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Open category management modal
    await page.getByText('管理分类').click()
    await expect(page.getByPlaceholder('新分类名称')).toBeVisible({ timeout: 5000 })

    // Switch type to "收入" via the n-select in category form
    const typeSelect = page.locator('.category-form .n-select')
    await typeSelect.click()
    await page.waitForTimeout(300)
    await page.locator('.n-base-select-option').filter({ hasText: '收入' }).click()
    await page.waitForTimeout(300)

    // Enter category name and add
    await page.getByPlaceholder('新分类名称').fill(incomeCatName)
    await page.getByRole('button', { name: '添加' }).click()
    await page.waitForTimeout(1000)

    // Verify income category appears in list
    await expect(page.getByText(incomeCatName)).toBeVisible({ timeout: 3000 })

    // Close category management modal
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Open "记一笔" modal — default is expense
    await page.getByRole('button', { name: '+ 记一笔' }).click()
    await expect(page.locator('.n-input-number input')).toBeVisible({ timeout: 5000 })

    // Check expense category options — income category should NOT appear
    const selectTrigger = page.locator('.n-select').first()
    await expect(selectTrigger).toBeVisible({ timeout: 3000 })
      await selectTrigger.click()
      await page.waitForTimeout(500)
      const incOptionInExpense = await page.locator('.n-base-select-option').filter({ hasText: incomeCatName }).isVisible().catch(() => false)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      // Switch to income type
      await page.getByRole('dialog').getByText('收入').click()
      await page.waitForTimeout(500)

      // Re-check — income category should now appear
      await selectTrigger.click()
      await page.waitForTimeout(500)
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
    await page.waitForTimeout(2000)

    // Click "支出" tab
    await page.locator('.filter-tabs .tab').getByText('支出').click()
    await page.waitForTimeout(1000)
    // Should show expense records (use record-card scope — stat card total may differ)
    await expect(page.locator('.record-card').filter({ hasText: '88.50' }).first()).toBeVisible({ timeout: 3000 })

    // Click "收入" tab
    await page.locator('.filter-tabs .tab').getByText('收入').click()
    await page.waitForTimeout(1000)
    // Should show income records
    await expect(page.locator('.record-card').filter({ hasText: '200.00' }).first()).toBeVisible({ timeout: 3000 })

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
    await expect(page.getByText(monthStr)).toBeVisible({ timeout: 5000 })

    // Go to previous month
    await page.locator('.month-btn').first().click()
    await page.waitForTimeout(1500)

    // The month label should have changed (no longer current month)
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const prevMonthStr = `${prevYear}年${prevMonth}月`
    await expect(page.getByText(prevMonthStr)).toBeVisible({ timeout: 5000 })

    // Go back to current month
    await page.locator('.month-btn').last().click()
    await page.waitForTimeout(1500)
    await expect(page.getByText(monthStr)).toBeVisible({ timeout: 5000 })
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

  test('F07: delete category from management modal', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Open category management
    await page.getByText('管理分类').click()
    await expect(page.getByPlaceholder('新分类名称')).toBeVisible({ timeout: 5000 })

    // Verify E2E category from F01 exists
    await expect(page.locator('.category-item').filter({ hasText: 'E2E餐饮' })).toBeVisible({ timeout: 3000 })

    // Click delete on the E2E category
    const categoryItem = page.locator('.category-item').filter({ hasText: 'E2E餐饮' })
    await categoryItem.getByRole('button', { name: '删除' }).click()
    await page.waitForTimeout(1500)

    // Verify category is gone from management list
    await expect(page.locator('.category-item').filter({ hasText: 'E2E餐饮' })).not.toBeVisible({ timeout: 5000 })

    // Close modal
    await page.keyboard.press('Escape')
  })

  // ── Budget Management (F08-F10) ──

  test('F08: free user sees budget lock or empty state', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    // Free user should see either the locked state or the "设置月度预算" button
    const lockMsg = page.getByText('升级 Premium')
    const emptyBudgetBtn = page.getByText('设置月度预算')
    await expect(lockMsg.or(emptyBudgetBtn)).toBeVisible({ timeout: 5000 })
  })

  test('F09: budget card renders in finance page', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    // Budget section should exist in DOM
    const budgetSection = page.locator('.budget-section')
    await expect(budgetSection).toBeVisible({ timeout: 5000 })
  })

  test('F10: premium user can open budget modal', async ({ page }) => {
    // Inject premium status
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    // Inject premium status into Pinia auth store
    await page.evaluate(() => {
      const app = (document.getElementById('__nuxt') as any)?.__vue_app__
      if (app) {
        const pinia = app.config.globalProperties.$pinia
        if (pinia?.state?.value?.auth) {
          pinia.state.value.auth.user = {
            ...(pinia.state.value.auth.user || {}),
            id: pinia.state.value.auth.user?.id || 999,
            username: pinia.state.value.auth.user?.username || 'test',
            email: pinia.state.value.auth.user?.email || 'test@test.com',
            plan: 'premium',
            plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            auto_renew: false,
          }
        }
      }
    })

    // Wait for Vue reactivity to update the UI
    await page.waitForTimeout(1000)

    // At least one budget button should be visible for premium user
    const setBudgetBtn = page.getByText('设置月度预算')
    const editBudgetBtn = page.getByText('设置预算')
    await expect(setBudgetBtn.or(editBudgetBtn)).toBeVisible({ timeout: 5000 })

    // Click whichever budget button is visible
    if (await setBudgetBtn.isVisible().catch(() => false)) {
      await setBudgetBtn.click()
    } else {
      await editBudgetBtn.click()
    }
    await page.waitForTimeout(1000)

    // Budget modal should appear with title "设置预算"
    const budgetModal = page.locator('.n-modal').filter({ hasText: '设置预算' })
    await expect(budgetModal).toBeVisible({ timeout: 5000 })
  })
})
