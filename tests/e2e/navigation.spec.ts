/**
 * E2E — Navigation & Quick-Add (N01–N06)
 *
 * Bottom nav: 待办(/) | 随手记(/ideas) | ＋(quick-add) | 记账(/finance) | 更多(/more)
 * More page: 手帐商店(/shop) | 我的仓库(/shop/inventory) | 密码本(/vault) | 重要日期(/important-dates) | 经期追踪(/period) | AI 报告(/ai/report) | 设置(/settings)
 */
import { test, expect } from './fixtures/auth.fixture'
import { waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

test.describe('Navigation', () => {
  test('N01: bottom nav tabs navigate correctly', async ({ authedPage: page }) => {
    await page.goto(BASE)
    await waitForHydration(page)

    // Navigate to 随手记
    await page.locator('.bottom-nav').getByText('随手记').click()
    await page.waitForURL('**/ideas')
    expect(page.url()).toContain('/ideas')

    // Navigate to 更多
    await page.locator('.bottom-nav').getByText('更多').click()
    await page.waitForURL('**/more')
    expect(page.url()).toContain('/more')

    // Navigate to 记账
    await page.locator('.bottom-nav').getByText('记账').click()
    await page.waitForURL('**/finance')
    expect(page.url()).toContain('/finance')

    // Navigate back to 待办
    await page.locator('.bottom-nav').getByText('待办').click()
    await page.waitForURL(BASE + '/')
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test('N02: more page feature cards navigate to subpages', async ({ authedPage: page }) => {
    await page.goto(`${BASE}/more`, { timeout: 30000 })
    await waitForHydration(page)
    await expect(page.getByText('更多功能')).toBeVisible({ timeout: 8000 })

    await expect(page.locator('.feature-card').filter({ hasText: '密码本' })).toBeVisible()
    await expect(page.locator('.feature-card').filter({ hasText: '重要日期' })).toBeVisible()
    await expect(page.locator('.feature-card').filter({ hasText: '经期追踪' })).toBeVisible()
    await expect(page.locator('.feature-card').filter({ hasText: '每日打卡' })).toBeVisible()
    await expect(page.locator('.feature-card').filter({ hasText: '设置' })).toBeVisible()
    await expect(page.locator('.feature-card').filter({ hasText: '手帐商店' })).toBeVisible()
    await expect(page.locator('.feature-card').filter({ hasText: 'AI 报告' })).toBeVisible()

    await page.locator('.feature-card').filter({ hasText: '密码本' }).click()
    await page.waitForURL('**/vault', { timeout: 30000 })
    expect(page.url()).toContain('/vault')

    await page.goto(`${BASE}/more`, { timeout: 30000 })
    await page.locator('.feature-card').filter({ hasText: '重要日期' }).click()
    await page.waitForURL('**/important-dates', { timeout: 30000 })
    expect(page.url()).toContain('/important-dates')

    await page.goto(`${BASE}/more`, { timeout: 30000 })
    await page.locator('.feature-card').filter({ hasText: '经期追踪' }).click()
    await page.waitForURL('**/period', { timeout: 30000 })
    expect(page.url()).toContain('/period')

    await page.goto(`${BASE}/more`, { timeout: 30000 })
    await page.locator('.feature-card').filter({ hasText: '设置' }).click()
    await page.waitForURL('**/settings', { timeout: 30000 })
    expect(page.url()).toContain('/settings')
  })

  test('N03: quick-add FAB opens modal', async ({ authedPage: page }) => {
    await page.goto(BASE)
    await waitForHydration(page)

    // Click the center "+" FAB
    await expect(page.locator('.page-title')).toContainText('待办事项', { timeout: 8000 })
    await page.keyboard.press('Escape')
    await page.locator('.nav-add').waitFor(); await page.evaluate(() => (document.querySelector('.nav-add') as HTMLElement)?.click())
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 8000 }).catch(async () => { await page.evaluate(() => (document.querySelector('.nav-add') as HTMLElement)?.click()); await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 8000 }) })

    await expect(page.getByRole('button', { name: '新建待办' })).toBeVisible()
    await expect(page.getByRole('button', { name: '保存为随手记' })).toBeVisible()
  })

  test('N04: active tab is highlighted', async ({ authedPage: page }) => {
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)

    const ideasNavItem = page.locator('.nav-item').filter({ hasText: '随手记' })
    await expect(ideasNavItem).toHaveClass(/active/, { timeout: 5000 })

    await page.goto(BASE)
    await waitForHydration(page)

    const todoNavItem = page.locator('.nav-item').filter({ hasText: '待办' })
    await expect(todoNavItem).toHaveClass(/active/, { timeout: 5000 })
  })

  test('N05: quick-add saves content as idea', async ({ authedPage: page }) => {
    await page.goto(BASE)
    await waitForHydration(page)

    const ideaText = `E2E QuickIdea ${Date.now()}`

    await expect(page.locator('.page-title')).toContainText('待办事项', { timeout: 8000 })
    await page.keyboard.press('Escape')
    await page.locator('.nav-add').waitFor(); await page.evaluate(() => (document.querySelector('.nav-add') as HTMLElement)?.click())
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 8000 }).catch(async () => { await page.evaluate(() => (document.querySelector('.nav-add') as HTMLElement)?.click()); await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 8000 }) })

    await page.getByPlaceholder('输入内容...').fill(ideaText)

    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/ideas') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '保存为随手记' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await expect(page.getByText(ideaText)).toBeVisible({ timeout: 8000 })
  })

  test('N06: quick-add buttons disabled when input empty', async ({ authedPage: page }) => {
    await page.goto(BASE)
    await waitForHydration(page)

    await expect(page.locator('.page-title')).toContainText('待办事项', { timeout: 8000 })
    await page.keyboard.press('Escape')
    await page.locator('.nav-add').waitFor(); await page.evaluate(() => (document.querySelector('.nav-add') as HTMLElement)?.click())
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 8000 }).catch(async () => { await page.evaluate(() => (document.querySelector('.nav-add') as HTMLElement)?.click()); await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 8000 }) })

    const todoBtn = page.getByRole('button', { name: '新建待办' })
    const ideaBtn = page.getByRole('button', { name: '保存为随手记' })
    await expect(todoBtn).toBeDisabled({ timeout: 3000 })
    await expect(ideaBtn).toBeDisabled({ timeout: 3000 })

    // Type something — buttons should become enabled
    await page.getByPlaceholder('输入内容...').fill('test content')
    await expect(todoBtn).toBeEnabled({ timeout: 3000 })
    await expect(ideaBtn).toBeEnabled({ timeout: 3000 })

    // Clear input — buttons should be disabled again
    await page.getByPlaceholder('输入内容...').fill('')
    await expect(todoBtn).toBeDisabled({ timeout: 3000 })
    await expect(ideaBtn).toBeDisabled({ timeout: 3000 })

    await page.keyboard.press('Escape')
  })
})
