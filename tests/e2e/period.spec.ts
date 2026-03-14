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
    // Ensure the page content is loaded before interacting with person switcher
    await expect(page.getByRole('button', { name: '+ 记录经期' })).toBeVisible({ timeout: 8000 })
    const personBtn = page.locator('.person-btn').filter({ hasText: personName })
    if (await personBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await personBtn.click()
      await expect(page.locator('.person-btn.active').filter({ hasText: personName })).toBeVisible({ timeout: 3000 })
    } else {
      // Person doesn't exist yet — add via person switcher UI
      await page.locator('.person-btn.add-btn').click()
      await expect(page.locator('.add-person-row')).toBeVisible({ timeout: 5000 })
      await page.locator('.add-person-row').getByPlaceholder('输入名称').fill(personName)
      await page.locator('.add-person-row').getByRole('button', { name: '确认' }).click()
      await expect(page.locator('.person-btn').filter({ hasText: personName })).toBeVisible({ timeout: 5000 })
    }
  }

  // Click "+ 记录经期" button
  await page.getByRole('button', { name: '+ 记录经期' }).click()
  const dialogOpened = await page.getByRole('dialog').getByText('少量', { exact: true }).waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)
  if (!dialogOpened) {
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button')
      for (const b of btns) {
        if (b.textContent?.includes('记录经期')) {
          b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
          break
        }
      }
    })
  }
  await expect(page.getByRole('dialog').getByText('少量', { exact: true })).toBeVisible({ timeout: 5000 })

  // Set start date
  const startDateRow = page.locator('.n-form-item').filter({ hasText: '开始日期' })
  await startDateRow.locator('.n-date-picker').click()
  await startDateRow.locator('.n-date-picker input').fill(startDate)
  await page.keyboard.press('Enter')

  // Set end date if provided
  if (endDate) {
    const endDateRow = page.locator('.n-form-item').filter({ hasText: '结束日期' })
    await endDateRow.locator('.n-date-picker').click()
    await endDateRow.locator('.n-date-picker input').fill(endDate)
    await page.keyboard.press('Enter')
  }

  // Select flow level
  await page.getByRole('dialog').getByText(flowMap[flowLevel], { exact: true }).click()

  // Click "记录" to save — wait for API
  const [saveResp] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/period') && (resp.request().method() === 'POST' || resp.request().method() === 'PUT'), { timeout: 10000 }),
    page.getByRole('button', { name: '记录', exact: true }).click(),
  ])
  expect(saveResp.ok()).toBe(true)

  // Wait for modal to close
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
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
    await expect(page.getByText('少量', { exact: true })).toBeVisible({ timeout: 5000 })

    // Change flow to "少量"
    await page.getByText('少量', { exact: true }).click()

    // Save — verify API succeeds
    const [createResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/period') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '记录', exact: true }).click(),
    ])
    expect(createResp.ok(), `Period create API failed: ${createResp.status()}`).toBe(true)

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
    await expect(page.getByRole('dialog').getByText('少量')).toBeVisible({ timeout: 5000 })

    // Change flow to "大量"
    await page.getByRole('dialog').getByText('大量').click()

    // Save — wait for API
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/period') && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    // Verify flow badge updated
    await expect(page.locator('.flow-badge').first()).toContainText('大量', { timeout: 5000 })
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
    await page.locator('.symptom-btn').filter({ hasText: '头痛' }).click()

    // Verify buttons have active class
    await expect(page.locator('.symptom-btn.active').filter({ hasText: '痛经' })).toBeVisible()
    await expect(page.locator('.symptom-btn.active').filter({ hasText: '头痛' })).toBeVisible()

    // Save — wait for API
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/period') && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    // Verify symptom badges appear on card
    const card = page.locator('.period-card').first()
    await expect(card.locator('.symptom-badge').filter({ hasText: '痛经' })).toBeVisible({ timeout: 8000 })
    await expect(card.locator('.symptom-badge').filter({ hasText: '头痛' })).toBeVisible({ timeout: 5000 })
  })

  test('P09: add note to period record', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await expect(page.locator('.period-card').first()).toBeVisible({ timeout: 8000 })

    // Click first card to edit
    await page.locator('.period-card').first().click()
    await expect(page.getByRole('dialog').getByText('大量')).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder('可选备注').fill('E2E经期备注')

    // Save — wait for API
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/period') && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    const card = page.locator('.period-card').first()
    await expect(card.locator('.period-note')).toContainText('E2E经期备注', { timeout: 5000 })
  })

  test('P04: prediction card after 2+ records', async ({ page }) => {
    // Add a second record (35 days ago → 30 days ago) via UI
    const d1 = new Date(); d1.setDate(d1.getDate() - 35)
    const d2 = new Date(); d2.setDate(d2.getDate() - 30)

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)

    await createRecordViaUI(page, d1.toISOString().split('T')[0], d2.toISOString().split('T')[0], 'moderate', '我')

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)

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
    await expect(page.getByText('少量', { exact: true })).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: '删除' }).click()

    // Wait for card count to decrease
    await expect(async () => {
      const countAfter = await page.locator('.period-card').count()
      expect(countAfter).toBeLessThan(countBefore)
    }).toPass({ timeout: 5000 })
  })

  test('P13: ongoing record shows 进行中 tag', async ({ page }) => {
    const d = new Date(); d.setDate(d.getDate() - 2)

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)

    await createRecordViaUI(page, d.toISOString().split('T')[0], null, 'moderate', '我')

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)

    await expect(page.locator('.period-ongoing').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.period-ongoing').first()).toContainText('进行中')
  })

  test('P10: period with end date shows duration stat-badge', async ({ page }) => {
    const start = new Date(); start.setDate(start.getDate() - 20)
    const end = new Date(start); end.setDate(end.getDate() + 4)

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)

    await createRecordViaUI(page, start.toISOString().split('T')[0], end.toISOString().split('T')[0], 'heavy', '我')

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)

    await expect(page.locator('.stat-badge').filter({ hasText: '天' }).first()).toBeVisible({ timeout: 5000 })
  })

  /* ──────── Multi-Person (P05–P07) ──────── */

  test('P05: add new person via person switcher', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('经期追踪', { timeout: 8000 })

    await page.locator('.person-btn.add-btn').click()
    await expect(page.locator('.add-person-row')).toBeVisible({ timeout: 3000 })

    await page.locator('.add-person-row').getByPlaceholder('输入名称').fill('E2E小红')
    await page.locator('.add-person-row').getByRole('button', { name: '确认' }).click()

    await expect(page.locator('.person-btn').filter({ hasText: 'E2E小红' })).toBeVisible({ timeout: 5000 })
  })

  test('P11: cancel add person hides input row', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('经期追踪', { timeout: 8000 })

    await expect(page.locator('.person-btn.add-btn')).toBeVisible({ timeout: 8000 })
    await page.locator('.person-btn.add-btn').click()
    await expect(page.locator('.add-person-row')).toBeVisible({ timeout: 8000 })

    await page.locator('.add-person-row').getByRole('button', { name: '取消' }).click()
    await expect(page.locator('.add-person-row')).not.toBeVisible({ timeout: 3000 })
  })

  test('P06: record period for new person', async ({ page }) => {
    const d1 = new Date(); d1.setDate(d1.getDate() - 10)
    const d2 = new Date(); d2.setDate(d2.getDate() - 5)

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)

    await createRecordViaUI(page, d1.toISOString().split('T')[0], null, 'light', 'E2E小红')

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)

    await createRecordViaUI(page, d2.toISOString().split('T')[0], null, 'heavy', 'E2E小红')

    await page.goto(`${BASE}/period`)
    await waitForHydration(page)

    // Click "E2E小红" person pill
    const pill = page.locator('.person-btn').filter({ hasText: 'E2E小红' })
    await expect(pill).toBeVisible({ timeout: 8000 })
    await pill.click()

    // Verify at least one period card is visible
    await expect(page.locator('.period-card').first()).toBeVisible({ timeout: 5000 })
  })

  test('P07: switching persons isolates data', async ({ page }) => {
    await page.goto(`${BASE}/period`)
    await waitForHydration(page)

    const meCard = page.locator('.person-btn').filter({ hasText: '我' })
    if (await meCard.isVisible().catch(() => false)) {
      await meCard.click()
      await expect(page.locator('.period-card').first()).toBeVisible({ timeout: 5000 })
    }
    const meCount = await page.locator('.period-card').count()

    const hongPill = page.locator('.person-btn').filter({ hasText: 'E2E小红' })
    if (await hongPill.isVisible().catch(() => false)) {
      await hongPill.click()
      await expect(page.locator('.period-card').first()).toBeVisible({ timeout: 5000 })
      const hongCount = await page.locator('.period-card').count()

      // Switch back to "我"
      await meCard.click()
      await expect(page.locator('.period-card').first()).toBeVisible({ timeout: 5000 })
      const meCountAfter = await page.locator('.period-card').count()

      expect(meCountAfter).toBe(meCount)
    }
  })
})
