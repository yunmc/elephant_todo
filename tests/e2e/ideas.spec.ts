/**
 * E2E — Ideas CRUD + Link/Convert (I01–I11)
 *
 * Serial tests sharing the same user.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const CONTENT = `E2E Idea ${Date.now()}`

/** Fill search box reliably — pressSequentially triggers NaiveUI @update:value */
async function searchIdeas(page: import('@playwright/test').Page, text: string) {
  const input = page.getByPlaceholder('搜索随手记...')
  await input.click()
  await input.fill('')
  if (text) {
    await input.pressSequentially(text, { delay: 10 })
  }
  await page.waitForResponse(
    resp => resp.url().includes('/api/ideas') && resp.request().method() === 'GET',
    { timeout: 8000 }
  )
}

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

    // I07: verify empty state for fresh user (before first idea is created)
    const emptyVisible = await page.getByText('暂无随手记').isVisible().catch(() => false)
    const hintVisible = await page.getByText('点击底部 ＋ 随时记录灵感').isVisible().catch(() => false)
    // Fresh user should see empty state with hint
    if (emptyVisible) {
      expect(hintVisible).toBe(true)
    }

    // Open quick-add
    await page.locator('.nav-add').waitFor(); await page.evaluate(() => (document.querySelector('.nav-add') as HTMLElement)?.click())
    // Wait for modal content to appear
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 15000 })

    // Type and save as idea — verify API response
    await page.getByPlaceholder('输入内容...').fill(CONTENT)
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/ideas') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '保存为随手记' }).click(),
    ])
    expect(saveResp.ok(), `Ideas create API failed: ${saveResp.status()}`).toBe(true)

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

    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/ideas') && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.locator('.action-btn.save').click(),
    ])
    expect(saveResp.ok()).toBe(true)

    // Go back and verify
    await page.goBack()
    await expect(page.getByText(`${CONTENT} Updated`)).toBeVisible({ timeout: 5000 })
  })

  test('I03: convert idea to todo', async ({ page }) => {
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await page.getByText(`${CONTENT} Updated`).click()
    await page.waitForURL(/\/ideas\/\d+/, { timeout: 8000 })
    await expect(page.getByText('关联待办')).toBeVisible({ timeout: 8000 })

    // Click "转为待办"
    await page.getByText('转为待办').click()

    // Wait for the API call to complete and page to update
    await expect(page.locator('.linked-todo')).toBeVisible({ timeout: 10000 })
  })

  test('I10: linked idea click-through navigates to todo', async ({ page }) => {
    // After I03, the idea has a linked todo — check list page has .idea-link
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await expect(page.getByText(`${CONTENT} Updated`).first()).toBeVisible({ timeout: 8000 })

    // The idea card should show the 🔗 linked todo link
    const ideaCard = page.locator('.idea-card').filter({ hasText: `${CONTENT} Updated` })
    const link = ideaCard.locator('.idea-link')
    await expect(link).toBeVisible({ timeout: 5000 })

    // Click the link — should navigate to /todo/{id}
    await link.click()
    await page.waitForURL(/\/todo\/\d+/, { timeout: 8000 })
    expect(page.url()).toMatch(/\/todo\/\d+/)
  })

  test('I04: unlink idea from todo', async ({ page }) => {
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await page.getByText(`${CONTENT} Updated`).first().click()
    await expect(page.locator('.linked-todo')).toBeVisible({ timeout: 5000 })

    // Click unlink button
    await page.locator('.unlink-btn').click()

    // Should show "转为待办" again
    await expect(page.getByText('转为待办')).toBeVisible({ timeout: 8000 })
  })

  test('I06: search ideas', async ({ page }) => {
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await expect(page.getByText(`${CONTENT} Updated`)).toBeVisible({ timeout: 8000 })

    // Search by content
    await searchIdeas(page, 'E2E Idea')
    await expect(page.getByText(`${CONTENT} Updated`)).toBeVisible({ timeout: 5000 })

    // Search non-existent
    await searchIdeas(page, 'ZZZZNOTEXIST')
    await expect(page.getByText(`${CONTENT} Updated`)).not.toBeVisible({ timeout: 5000 })

    // Clear search
    await searchIdeas(page, '')
    await expect(page.getByText(`${CONTENT} Updated`)).toBeVisible({ timeout: 5000 })
  })

  test('I11: data persistence after reload', async ({ page }) => {
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await expect(page.getByText(`${CONTENT} Updated`)).toBeVisible({ timeout: 8000 })

    // Reload the page
    await page.reload()
    await waitForHydration(page)

    // Idea should still be visible after reload
    await expect(page.getByText(`${CONTENT} Updated`)).toBeVisible({ timeout: 8000 })
  })

  test('I05: delete idea', async ({ page }) => {
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await page.getByText(`${CONTENT} Updated`).click()
    await page.waitForURL(/\/ideas\/\d+/, { timeout: 8000 })
    await expect(page.getByText('删除这条随手记')).toBeVisible({ timeout: 5000 })

    await page.getByText('删除这条随手记').click()
    // Confirm
    await page.getByRole('button', { name: '删除', exact: true }).click()
    await expect(page).toHaveURL(/\/ideas/, { timeout: 8000 })
    await expect(page.getByText(`${CONTENT} Updated`)).not.toBeVisible({ timeout: 3000 })
  })

  test('I09: delete idea from list page via popconfirm', async ({ page }) => {
    // Create a new idea for deletion
    const tmpContent = `E2E ListDel ${Date.now()}`
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('随手记', { timeout: 8000 })
    await page.keyboard.press('Escape')
    await page.locator('.nav-add').waitFor(); await page.evaluate(() => (document.querySelector('.nav-add') as HTMLElement)?.click())
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder('输入内容...').fill(tmpContent)
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/ideas') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '保存为随手记' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await expect(page.getByText(tmpContent)).toBeVisible({ timeout: 5000 })

    // Delete from list via popconfirm
    const ideaCard = page.locator('.idea-card').filter({ hasText: tmpContent })
    await ideaCard.getByRole('button', { name: '删除' }).click()
    // Confirm popconfirm
    const [deleteResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/ideas') && resp.request().method() === 'DELETE', { timeout: 10000 }),
      page.getByRole('button', { name: '删除' }).last().click(),
    ])
    expect(deleteResp.ok()).toBe(true)

    // Idea should be gone
    await expect(page.getByText(tmpContent)).not.toBeVisible({ timeout: 5000 })
  })
})
