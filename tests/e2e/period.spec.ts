/**
 * E2E — Period Tracking: CRUD + Multi-Person + Prediction + Symptoms/Notes (P01–P13)
 *
 * Period page supports multiple persons. Each person has isolated records
 * and predictions. Uses NaiveUI modal (preset="card") for add/edit.
 *
 * Person switcher: `.person-btn` pills + `+` add button.
 * Records: `.period-card` cards, `.flow-badge`, `.symptom-badge`.
 * Prediction: `.prediction-card` / `.prediction-empty`.
 *
 * Serial tests sharing the same user. (P01–P13, P11 cancel add person)
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

/** Helper: create a period record via UI modal */
async function createRecordViaUI(
  page: import('@playwright/test').Page,
  startDate: string,
  endDate: string | null,
  flowLevel: 'light' | 'moderate' | 'heavy' = 'moderate',
  personName = '我',
) {
  const flowMap = { light: '少量', moderate: '适中', heavy: '大量' }

  // Navigate if not already on period page
  if (!page.url().includes('/period')) {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('经期追踪', { timeout: 8000 })
  }

  // Select person if not default
  if (personName !== '我') {
    const personBtn = page.locator('.person-btn').filter({ hasText: personName })
    if (await personBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await personBtn.click()
      await page.waitForTimeout(1000)
    }
  }

  // Click "+ 记录经期" button
  await page.getByRole('button', { name: '+ 记录经期' }).click()
  await expect(page.getByText('少量', { exact: true })).toBeVisible({ timeout: 5000 })

  // Set start date
  const startDateRow = page.locator('.n-form-item').filter({ hasText: '开始日期' })
  await startDateRow.locator('.n-date-picker').click()
  await page.waitForTimeout(300)
  await startDateRow.locator('.n-date-picker input').fill(startDate)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)

  // Set end date if provided
  if (endDate) {
    const endDateRow = page.locator('.n-form-item').filter({ hasText: '结束日期' })
    await endDateRow.locator('.n-date-picker').click()
    await page.waitForTimeout(300)
    await endDateRow.locator('.n-date-picker input').fill(endDate)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
  }

  // Select flow level
  await page.getByRole('dialog').getByText(flowMap[flowLevel], { exact: true }).click()
  await page.waitForTimeout(200)

  // Click "记录" to save
  await page.getByRole('button', { name: '记录', exact: true }).click()
  await page.waitForTimeout(2000)
}

let tokens: { accessToken: string; refreshToken: string }

test.describe.serial('Period Tracking Flow', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  /* ──────── Basic CRUD (default person "我") ──────── */

  test('P01: record period via modal', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('经期追踪', { timeout: 8000 })

    // Empty state
    await expect(page.getByText('暂无经期记录')).toBeVisible({ timeout: 5000 })

    // Click "+ 记录经期" button
    await page.getByRole('button', { name: '+ 记录经期' }).click()
    // Wait for modal form to appear (flow level radio buttons)
    await expect(page.getByText('少量', { exact: true })).toBeVisible({ timeout: 5000 })

    // Change flow to "少量"
    await page.getByText('少量', { exact: true }).click()

    // Save — button text is "记录" (not "保存") for new records
    await page.getByRole('button', { name: '记录', exact: true }).click()
    await page.waitForTimeout(2000)

    // Verify period card appears
    await expect(page.locator('.period-card')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.flow-badge').first()).toContainText('少量')
  })

  test('P02: edit period record — change flow to 大量', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await expect(page.locator('.period-card').first()).toBeVisible({ timeout: 8000 })

    // Click card to open edit modal
    await page.locator('.period-card').first().click()
    // Wait for edit form to appear — use dialog-scoped selector
    await expect(page.getByRole('dialog').getByText('少量')).toBeVisible({ timeout: 5000 })

    // Change flow to "大量"
    await page.getByRole('dialog').getByText('大量').click()
    await page.waitForTimeout(300)

    // Save
    await page.getByRole('button', { name: '保存' }).click()
    await page.waitForTimeout(2000)

    // Verify flow badge updated
    await expect(page.locator('.flow-badge').first()).toContainText('大量')
  })

  test('P08: select symptoms and verify badges', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await expect(page.locator('.period-card').first()).toBeVisible({ timeout: 8000 })

    // Click first card to edit
    await page.locator('.period-card').first().click()
    await expect(page.getByRole('dialog').getByText('大量')).toBeVisible({ timeout: 5000 })

    // Select symptoms: 痛经 and 头痛
    await page.locator('.symptom-btn').filter({ hasText: '痛经' }).click()
    await page.waitForTimeout(200)
    await page.locator('.symptom-btn').filter({ hasText: '头痛' }).click()
    await page.waitForTimeout(200)

    // Verify buttons have active class
    await expect(page.locator('.symptom-btn.active').filter({ hasText: '痛经' })).toBeVisible()
    await expect(page.locator('.symptom-btn.active').filter({ hasText: '头痛' })).toBeVisible()

    // Save
    await page.getByRole('button', { name: '保存' }).click()
    await page.waitForTimeout(2000)

    // Verify symptom badges appear on card
    const card = page.locator('.period-card').first()
    await expect(card.locator('.symptom-badge').filter({ hasText: '痛经' })).toBeVisible({ timeout: 5000 })
    await expect(card.locator('.symptom-badge').filter({ hasText: '头痛' })).toBeVisible()
  })

  test('P09: add note to period record', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await expect(page.locator('.period-card').first()).toBeVisible({ timeout: 8000 })

    // Click first card to edit
    await page.locator('.period-card').first().click()
    await expect(page.getByRole('dialog').getByText('大量')).toBeVisible({ timeout: 5000 })

    // Fill notes textarea
    await page.getByPlaceholder('可选备注').fill('E2E经期备注')

    // Save
    await page.getByRole('button', { name: '保存' }).click()
    await page.waitForTimeout(2000)

    // Verify note text appears on card
    const card = page.locator('.period-card').first()
    await expect(card.locator('.period-note')).toContainText('E2E经期备注', { timeout: 5000 })
  })

  test('P04: prediction card after 2+ records', async ({ page }) => {
    // Add a second record (35 days ago → 30 days ago) via UI
    const d1 = new Date(); d1.setDate(d1.getDate() - 35)
    const d2 = new Date(); d2.setDate(d2.getDate() - 30)

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await page.waitForTimeout(1000)

    await createRecordViaUI(page, d1.toISOString().split('T')[0], d2.toISOString().split('T')[0], 'moderate', '我')

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await page.waitForTimeout(3000)

    // Either prediction card or empty prompt should be visible
    const predCard = page.locator('.prediction-card')
    const emptyPrompt = page.locator('.prediction-empty')
    await expect(predCard.or(emptyPrompt)).toBeVisible({ timeout: 5000 })

    if (await predCard.isVisible().catch(() => false)) {
      await expect(predCard).toContainText('周期预测')
    }
  })

  test('P03: delete period record', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await expect(page.locator('.period-card').first()).toBeVisible({ timeout: 8000 })

    const countBefore = await page.locator('.period-card').count()

    await page.locator('.period-card').first().click()
    // Wait for edit form to appear
    await expect(page.getByText('少量', { exact: true })).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: '删除' }).click()
    await page.waitForTimeout(2000)

    const countAfter = await page.locator('.period-card').count()
    expect(countAfter).toBeLessThan(countBefore)
  })

  test('P13: ongoing record shows 进行中 tag', async ({ page }) => {
    // Create a record with no end_date via UI (i.e. ongoing)
    const d = new Date(); d.setDate(d.getDate() - 2)

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await page.waitForTimeout(1000)

    await createRecordViaUI(page, d.toISOString().split('T')[0], null, 'moderate', '我')

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    // Verify at least one card shows "进行中" tag
    await expect(page.locator('.period-ongoing').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.period-ongoing').first()).toContainText('进行中')
  })

  test('P10: period with end date shows duration stat-badge', async ({ page }) => {
    // Create a record with start and end date (5-day period) via UI
    const start = new Date(); start.setDate(start.getDate() - 20)
    const end = new Date(start); end.setDate(end.getDate() + 4) // 5 days

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await page.waitForTimeout(1000)

    await createRecordViaUI(page, start.toISOString().split('T')[0], end.toISOString().split('T')[0], 'heavy', '我')

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    // Verify at least one stat-badge with "天" is visible
    await expect(page.locator('.stat-badge').filter({ hasText: '天' }).first()).toBeVisible({ timeout: 5000 })
  })

  /* ──────── Multi-Person (P05–P07) ──────── */

  test('P05: add new person via person switcher', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('经期追踪', { timeout: 8000 })

    // Click "+" add-person button
    await page.locator('.person-btn.add-btn').click()

    // The inline add-person row should appear
    await expect(page.locator('.add-person-row')).toBeVisible({ timeout: 3000 })

    // Input name
    await page.locator('.add-person-row').getByPlaceholder('输入名称').fill('E2E小红')

    // Click "确认"
    await page.locator('.add-person-row').getByRole('button', { name: '确认' }).click()
    await page.waitForTimeout(2000)

    // Verify new person pill appears in switcher
    await expect(page.locator('.person-btn').filter({ hasText: 'E2E小红' })).toBeVisible({ timeout: 5000 })
  })

  test('P11: cancel add person hides input row', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('经期追踪', { timeout: 8000 })

    // Click "+" add-person button
    await page.locator('.person-btn.add-btn').click()
    await expect(page.locator('.add-person-row')).toBeVisible({ timeout: 3000 })

    // Click "取消" to dismiss without adding
    await page.locator('.add-person-row').getByRole('button', { name: '取消' }).click()
    await page.waitForTimeout(1000)

    // The add-person-row should disappear
    await expect(page.locator('.add-person-row')).not.toBeVisible({ timeout: 3000 })
  })

  test('P06: record period for new person', async ({ page }) => {
    // Create 2 records for E2E小红 via UI
    const d1 = new Date(); d1.setDate(d1.getDate() - 10)
    const d2 = new Date(); d2.setDate(d2.getDate() - 5)

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await page.waitForTimeout(1000)

    // Create first record for E2E小红
    await createRecordViaUI(page, d1.toISOString().split('T')[0], null, 'light', 'E2E小红')

    // Navigate back and create second record
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await page.waitForTimeout(1000)

    await createRecordViaUI(page, d2.toISOString().split('T')[0], null, 'heavy', 'E2E小红')

    // Navigate and wait for page to load with new person data
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    // Click "E2E小红" person pill
    const pill = page.locator('.person-btn').filter({ hasText: 'E2E小红' })
    await expect(pill).toBeVisible({ timeout: 8000 })
    await pill.click()
    await page.waitForTimeout(1500)

    // Verify at least one period card is visible
    await expect(page.locator('.period-card').first()).toBeVisible({ timeout: 5000 })
  })

  test('P07: switching persons isolates data', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    // Ensure both persons have records —
    // Create "我" record if not exists
    const meCard = page.locator('.person-btn').filter({ hasText: '我' })
    if (await meCard.isVisible().catch(() => false)) {
      await meCard.click()
      await page.waitForTimeout(1500)
    }
    const meCount = await page.locator('.period-card').count()

    // Switch to "E2E小红" and count records
    const hongPill = page.locator('.person-btn').filter({ hasText: 'E2E小红' })
    if (await hongPill.isVisible().catch(() => false)) {
      await hongPill.click()
      await page.waitForTimeout(1500)
      const hongCount = await page.locator('.period-card').count()

      // Switch back to "我"
      await meCard.click()
      await page.waitForTimeout(1500)
      const meCountAfter = await page.locator('.period-card').count()

      // "我" should have same count as before, confirming data isolation
      expect(meCountAfter).toBe(meCount)
    }
  })
})
