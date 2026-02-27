/**
 * E2E — Navigation & Quick-Add (N01–N05)
 *
 * Bottom nav: 待办(/) | 随手记(/ideas) | ＋(quick-add) | 密码本(/vault) | 更多(/more)
 * More page: 记账(/finance) | 重要日期(/important-dates) | 经期追踪(/period) | 设置(/settings)
 */
import { test, expect } from './fixtures/auth.fixture'
import { waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

test.describe('Navigation', () => {
  test('N01: bottom nav tabs navigate correctly', async ({ authedPage: page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    // Navigate to 随手记
    await page.locator('.bottom-nav').getByText('随手记').click()
    await page.waitForURL('**/ideas')
    expect(page.url()).toContain('/ideas')

    // Navigate to 更多
    await page.locator('.bottom-nav').getByText('更多').click()
    await page.waitForURL('**/more')
    expect(page.url()).toContain('/more')

    // Navigate to 密码本
    await page.locator('.bottom-nav').getByText('密码本').click()
    await page.waitForURL('**/vault')
    expect(page.url()).toContain('/vault')

    // Navigate back to 待办
    await page.locator('.bottom-nav').getByText('待办').click()
    await page.waitForURL(BASE + '/')
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test('N02: more page feature cards navigate to subpages', async ({ authedPage: page }) => {
    await page.goto(`${BASE}/more`)
    await waitForHydration(page)
    await expect(page.getByText('更多功能')).toBeVisible({ timeout: 8000 })

    // Check all 4 feature cards are visible
    await expect(page.locator('.feature-card').filter({ hasText: '记账' })).toBeVisible()
    await expect(page.locator('.feature-card').filter({ hasText: '重要日期' })).toBeVisible()
    await expect(page.locator('.feature-card').filter({ hasText: '经期追踪' })).toBeVisible()
    await expect(page.locator('.feature-card').filter({ hasText: '设置' })).toBeVisible()

    // Click "记账" → /finance
    await page.locator('.feature-card').filter({ hasText: '记账' }).click()
    await page.waitForURL('**/finance')
    expect(page.url()).toContain('/finance')

    // Go back and click "重要日期" → /important-dates
    await page.goto(`${BASE}/more`)
    await page.locator('.feature-card').filter({ hasText: '重要日期' }).click()
    await page.waitForURL('**/important-dates')
    expect(page.url()).toContain('/important-dates')

    // Go back and click "经期追踪" → /period
    await page.goto(`${BASE}/more`)
    await page.locator('.feature-card').filter({ hasText: '经期追踪' }).click()
    await page.waitForURL('**/period')
    expect(page.url()).toContain('/period')

    // Go back and click "设置" → /settings
    await page.goto(`${BASE}/more`)
    await page.locator('.feature-card').filter({ hasText: '设置' }).click()
    await page.waitForURL('**/settings')
    expect(page.url()).toContain('/settings')
  })

  test('N03: quick-add FAB opens modal', async ({ authedPage: page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    // Click the center "+" FAB (dispatchEvent bypasses DevTools overlay)
    await page.locator('.nav-add-icon').dispatchEvent('click')
    // Wait for modal content to appear
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 5000 })

    // Modal should have the textarea
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible()

    // And both action buttons
    await expect(page.getByRole('button', { name: '新建待办' })).toBeVisible()
    await expect(page.getByRole('button', { name: '保存为随手记' })).toBeVisible()
  })

  test('N04: active tab is highlighted', async ({ authedPage: page }) => {
    // Navigate to 随手记
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await page.waitForTimeout(1500)

    // The 随手记 nav item should have .active class
    const ideasNavItem = page.locator('.nav-item').filter({ hasText: '随手记' })
    await expect(ideasNavItem).toHaveClass(/active/, { timeout: 5000 })

    // Navigate to 待办
    await page.goto(BASE)
    await waitForHydration(page)
    await page.waitForTimeout(1500)

    // The 待办 nav item should have .active class
    const todoNavItem = page.locator('.nav-item').filter({ hasText: '待办' })
    await expect(todoNavItem).toHaveClass(/active/, { timeout: 5000 })
  })

  test('N05: quick-add saves content as idea', async ({ authedPage: page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.waitForTimeout(2000)

    const ideaText = `E2E QuickIdea ${Date.now()}`

    // Open quick-add modal
    await page.locator('.nav-add-icon').dispatchEvent('click')
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 5000 })

    // Type content
    await page.getByPlaceholder('输入内容...').fill(ideaText)

    // Click "保存为随手记"
    await page.getByRole('button', { name: '保存为随手记' }).click()
    await page.waitForTimeout(2000)

    // Navigate to ideas page to verify
    await page.goto(`${BASE}/ideas`)
    await waitForHydration(page)
    await expect(page.getByText(ideaText)).toBeVisible({ timeout: 8000 })
  })
})
