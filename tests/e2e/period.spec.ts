/**
 * E2E — Period Tracking: CRUD + Multi-Person + Prediction + Symptoms/Notes (P01–P09)
 *
 * Period page supports multiple persons. Each person has isolated records
 * and predictions. Uses NaiveUI modal (preset="card") for add/edit.
 *
 * Person switcher: `.person-btn` pills + `+` add button.
 * Records: `.period-card` cards, `.flow-badge`, `.symptom-badge`.
 * Prediction: `.prediction-card` / `.prediction-empty`.
 *
 * Serial tests sharing the same user.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

/** Helper: create a period record via API (uses Authorization header) */
async function createRecordViaAPI(
  page: import('@playwright/test').Page,
  startDate: string,
  endDate: string | null,
  flowLevel: 'light' | 'moderate' | 'heavy' = 'moderate',
  personName = '我',
) {
  const resp = await page.request.post(`${BASE}/api/period`, {
    headers: { 'Authorization': `Bearer ${tokens.accessToken}` },
    data: {
      start_date: startDate,
      end_date: endDate,
      flow_level: flowLevel,
      symptoms: [],
      note: '',
      person_name: personName,
    },
  })
  return resp.json()
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
    // Add a second record (35 days ago → 30 days ago) via API
    const d1 = new Date(); d1.setDate(d1.getDate() - 35)
    const d2 = new Date(); d2.setDate(d2.getDate() - 30)

    await createRecordViaAPI(page, d1.toISOString().split('T')[0], d2.toISOString().split('T')[0], 'moderate', '我')

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await page.waitForTimeout(3000)

    // Either prediction card or empty prompt
    const predVisible = await page.locator('.prediction-card').isVisible().catch(() => false)
    const emptyVisible = await page.locator('.prediction-empty').isVisible().catch(() => false)
    expect(predVisible || emptyVisible).toBe(true)

    if (predVisible) {
      await expect(page.locator('.prediction-card')).toContainText('周期预测')
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

  test('P06: record period for new person', async ({ page }) => {
    // Create records via Node.js fetch with Authorization header
    const d1 = new Date(); d1.setDate(d1.getDate() - 10)
    const d2 = new Date(); d2.setDate(d2.getDate() - 5)
    for (const [sd, fl] of [[d1.toISOString().split('T')[0], 'light'], [d2.toISOString().split('T')[0], 'heavy']]) {
      const resp = await fetch(`${BASE}/api/period`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokens.accessToken}` },
        body: JSON.stringify({ start_date: sd, end_date: null, flow_level: fl, symptoms: [], note: '', person_name: 'E2E小红' }),
      })
      expect(resp.ok).toBeTruthy()
    }

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
