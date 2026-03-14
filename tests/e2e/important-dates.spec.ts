/**
 * E2E — Important Dates CRUD (D01–D11)
 *
 * Serial tests sharing the same user.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'
import { waitForSelectOpen, waitForSelectClose, waitForDatePickerOpen, waitForDatePickerClose } from './fixtures/naive-helpers'

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const TITLE = `E2E Birthday ${Date.now()}`

let tokens: { accessToken: string; refreshToken: string }

/** Click a date card by title text, with evaluate fallback for mobile */
async function clickDateCard(page: import('@playwright/test').Page, title: string) {
  const card = page.locator('.date-card').filter({ hasText: title })
  await card.scrollIntoViewIfNeeded()
  await card.click({ force: true })
  // Wait a moment for the modal to appear
  const opened = await page.locator('.n-modal').waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)
  if (!opened) {
    await page.evaluate((t) => {
      const cards = document.querySelectorAll('.date-card')
      for (const c of cards) {
        if (c.textContent?.includes(t)) {
          c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
          break
        }
      }
    }, title)
  }
  await expect(page.locator('.n-modal')).toBeVisible({ timeout: 8000 })
}

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

    // D08: verify empty state for fresh user
    await expect(page.getByText('暂无重要日期')).toBeVisible({ timeout: 5000 })

    // Click add button
    await page.getByRole('button', { name: '+ 添加重要日期' }).click()
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // Fill title
    await page.getByPlaceholder('如：妈妈的生日').fill(TITLE)

    // Pick a date (30 days from now)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const datePicker = page.locator('.n-date-picker')
    await datePicker.click()
    await waitForDatePickerOpen(page)
    const dateInput = datePicker.locator('input')
    await dateInput.fill(futureDate.toISOString().split('T')[0].replace(/-/g, '-'))
    await page.keyboard.press('Enter')

    // Click "添加" and verify API succeeds
    const [createResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/important-dates') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '添加', exact: true }).click(),
    ])
    expect(createResp.ok(), `Important dates create API failed: ${createResp.status()}`).toBe(true)

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
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // Change title
    const titleInput = page.getByPlaceholder('如：妈妈的生日')
    await titleInput.fill(`${TITLE} Edited`)

    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/important-dates') && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    // Verify updated title
    await expect(page.getByText(`${TITLE} Edited`)).toBeVisible({ timeout: 5000 })
  })

  test('D03: yearly repeat tag', async ({ page }) => {
    await page.goto(`${BASE}/important-dates`)
    await waitForHydration(page)
    await expect(page.locator('.date-tag').getByText('每年').first()).toBeVisible({ timeout: 5000 })
  })

  test('D05: icon picker — select birthday icon', async ({ page }) => {
    await page.goto(`${BASE}/important-dates`)
    await waitForHydration(page)
    await expect(page.getByText(`${TITLE} Edited`)).toBeVisible({ timeout: 8000 })

    await clickDateCard(page, `${TITLE} Edited`)
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 8000 })

    // Click 🎂 icon button and verify active
    await page.locator('.icon-btn').filter({ hasText: '🎂' }).click()
    await expect(page.locator('.icon-btn.active')).toContainText('🎂')

    // Save
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/important-dates') && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    // Verify the card now shows 🎂 icon
    const card = page.locator('.date-card').filter({ hasText: `${TITLE} Edited` })
    await expect(card.locator('.date-icon')).toContainText('🎂', { timeout: 5000 })
  })

  test('D06: add note to date', async ({ page }) => {
    await page.goto(`${BASE}/important-dates`)
    await waitForHydration(page)
    await expect(page.getByText(`${TITLE} Edited`)).toBeVisible({ timeout: 8000 })

    await clickDateCard(page, `${TITLE} Edited`)
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // Fill note
    await page.getByPlaceholder('可选备注').fill('E2E测试备注')

    // Save
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/important-dates') && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    // Verify the card shows the note
    const card = page.locator('.date-card').filter({ hasText: `${TITLE} Edited` })
    await expect(card.locator('.date-note')).toContainText('E2E测试备注', { timeout: 5000 })
  })

  test('D07: remind days setting persists', async ({ page }) => {
    await page.goto(`${BASE}/important-dates`)
    await waitForHydration(page)
    await expect(page.getByText(`${TITLE} Edited`)).toBeVisible({ timeout: 8000 })

    await clickDateCard(page, `${TITLE} Edited`)
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // Select "提前 7 天" remind option
    const remindSelect = page.locator('.n-form-item').filter({ hasText: '提前提醒' }).locator('.n-select')
    await remindSelect.click()
    await waitForSelectOpen(page)
    await page.locator('.n-base-select-option__content').filter({ hasText: '提前 7 天' }).click()
    await waitForSelectClose(page)

    // Save
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/important-dates') && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    // Re-open edit modal to verify persistence
    await clickDateCard(page, `${TITLE} Edited`)
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // The select should show "提前 7 天"
    await expect(
      page.locator('.n-form-item').filter({ hasText: '提前提醒' }).locator('.n-base-selection-label')
    ).toContainText('提前 7 天', { timeout: 3000 })

    // Close modal
    await page.keyboard.press('Escape')
  })

  test('D09: toggle repeat yearly off', async ({ page }) => {
    await page.goto(`${BASE}/important-dates`)
    await waitForHydration(page)
    await expect(page.getByText(`${TITLE} Edited`)).toBeVisible({ timeout: 8000 })

    await clickDateCard(page, `${TITLE} Edited`)
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // Change repeat type from "每年重复" to "不重复"
    const repeatSelect = page.locator('.n-form-item').filter({ hasText: '重复' }).first().locator('.n-select')
    await repeatSelect.click()
    await waitForSelectOpen(page)
    await page.locator('.n-base-select-option__content').filter({ hasText: '不重复' }).click()
    await waitForSelectClose(page)

    // Save
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/important-dates') && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    // Verify "每年" tag is no longer visible on this card
    const card = page.locator('.date-card').filter({ hasText: `${TITLE} Edited` })
    const yearlyTag = card.locator('.date-tag').getByText('每年')
    await expect(yearlyTag).not.toBeVisible({ timeout: 5000 })
  })

  test('D10: today date shows celebration or recent countdown', async ({ page }) => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`
    const todayTitle = `E2E Today ${Date.now()}`

    await page.goto(`${BASE}/important-dates`)
    await waitForHydration(page)

    // Click add button
    await page.getByRole('button', { name: '+ 添加重要日期' }).click()
    await expect(page.locator('.n-modal')).toBeVisible({ timeout: 8000 })
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // Fill title
    await page.getByPlaceholder('如：妈妈的生日').fill(todayTitle)

    // Set date to today
    const datePicker = page.locator('.n-date-picker')
    await datePicker.click()
    await waitForDatePickerOpen(page)
    const dateInput = datePicker.locator('input')
    await dateInput.fill(dateStr)
    await page.keyboard.press('Enter')

    // Set repeat_type to "不重复"
    const repeatSelect = page.locator('.n-form-item').filter({ hasText: '重复' }).locator('.n-select')
    if (await repeatSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await repeatSelect.click()
      await waitForSelectOpen(page)
      await page.locator('.n-base-select-option').filter({ hasText: '不重复' }).click()
      await waitForSelectClose(page)
    }

    // Select birthday icon
    await page.locator('.icon-btn').filter({ hasText: '🎂' }).click()
    await expect(page.locator('.icon-btn.active').filter({ hasText: '🎂' })).toBeVisible()

    // Click "添加"
    const [createResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/important-dates') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '添加', exact: true }).click(),
    ])
    expect(createResp.ok()).toBe(true)

    // The card should be visible with a countdown ("就是今天" or small day count)
    const card = page.locator('.date-card').filter({ hasText: todayTitle })
    await expect(card).toBeVisible({ timeout: 5000 })
    const countdownText = await card.locator('.countdown').textContent()
    const isToday = countdownText?.includes('就是今天')
    const isRecent = countdownText?.match(/^\d天前$/) || countdownText?.match(/^\d天后$/)
    expect(isToday || isRecent).toBeTruthy()
  })

  test('D11: past date shows days ago', async ({ page }) => {
    test.setTimeout(60000)
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 10)
    const dateStr = pastDate.toISOString().split('T')[0]
    const pastTitle = `E2E Past ${Date.now()}`

    await page.goto(`${BASE}/important-dates`, { timeout: 30000 })
    await waitForHydration(page)

    // Click add button and wait for modal
    await page.getByRole('button', { name: '+ 添加重要日期' }).click()
    if (!await page.locator('.n-modal').isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button')
        for (const b of btns) {
          if (b.textContent?.includes('添加重要日期')) {
            b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
            break
          }
        }
      })
    }
    await expect(page.locator('.n-modal')).toBeVisible({ timeout: 8000 })
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // Fill title
    await page.getByPlaceholder('如：妈妈的生日').fill(pastTitle)

    // Set date to 10 days ago
    const datePicker = page.locator('.n-date-picker')
    await datePicker.click()
    await waitForDatePickerOpen(page)
    const dateInput = datePicker.locator('input')
    await dateInput.fill(dateStr)
    await page.keyboard.press('Enter')

    // Select icon
    await page.locator('.icon-btn').filter({ hasText: '📅' }).click()
    await expect(page.locator('.icon-btn.active').filter({ hasText: '📅' })).toBeVisible()

    // Set repeat_type to "不重复"
    const repeatSelect = page.locator('.n-form-item').filter({ hasText: '重复' }).locator('.n-select')
    if (await repeatSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await repeatSelect.click()
      await waitForSelectOpen(page)
      await page.locator('.n-base-select-option').filter({ hasText: '不重复' }).click()
      await waitForSelectClose(page)
    }

    // Click "添加"
    const [createResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/important-dates') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '添加', exact: true }).click(),
    ])
    expect(createResp.ok()).toBe(true)

    // The card should show "天前" (days ago)
    const card = page.locator('.date-card').filter({ hasText: pastTitle })
    await expect(card).toBeVisible({ timeout: 5000 })
    await expect(card.locator('.countdown')).toContainText('天前', { timeout: 5000 })
  })

  test('D04: delete date', async ({ page }) => {
    await page.goto(`${BASE}/important-dates`)
    await waitForHydration(page)
    await expect(page.getByText(`${TITLE} Edited`)).toBeVisible({ timeout: 8000 })

    await clickDateCard(page, `${TITLE} Edited`)
    await expect(page.getByPlaceholder('如：妈妈的生日')).toBeVisible({ timeout: 5000 })

    // Click delete
    const [deleteResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/important-dates') && resp.request().method() === 'DELETE', { timeout: 10000 }),
      page.getByRole('button', { name: '删除' }).click(),
    ])
    expect(deleteResp.ok()).toBe(true)

    // Date should be gone
    await expect(page.getByText(`${TITLE} Edited`)).not.toBeVisible({ timeout: 5000 })
  })
})
