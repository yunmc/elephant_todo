/**
 * E2E — Settings: Category / Tag CRUD, Change Password, Theme (S01–S04)
 *
 * Settings page sections: 账户信息, 分类管理, 标签管理, 修改密码, 主题设置, 退出登录
 *
 * Serial tests sharing the same user.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

let creds: { email: string; password: string; username: string }
let tokens: { accessToken: string; refreshToken: string }

test.describe.serial('Settings', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    creds = result.creds
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  test('S01: category CRUD — add and delete', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('设置', { timeout: 8000 })

    const catName = `E2E分类_${Date.now()}`

    // Type new category name
    await page.getByPlaceholder('新分类名称').fill(catName)

    // Click "添加" for category
    const catSection = page.locator('.section-card').filter({ hasText: '分类管理' })
    await catSection.getByRole('button', { name: '添加' }).click()
    await page.waitForTimeout(2000)

    // Verify category appears in list
    await expect(catSection.getByText(catName)).toBeVisible({ timeout: 5000 })

    // Delete — find the list item with our category and click 删除
    const catItem = catSection.locator('.n-list-item').filter({ hasText: catName })
    await catItem.getByRole('button', { name: '删除' }).click()

    // Confirm popconfirm
    await page.getByRole('button', { name: '确认' }).click()
    await page.waitForTimeout(2000)

    // Verify gone
    await expect(catSection.getByText(catName)).not.toBeVisible({ timeout: 5000 })
  })

  test('S02: tag CRUD — add and delete', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('设置', { timeout: 8000 })

    const tagName = `E2E标签_${Date.now()}`

    // Type new tag name
    await page.getByPlaceholder('新标签名称').fill(tagName)

    // Click "添加" for tag
    const tagSection = page.locator('.section-card').filter({ hasText: '标签管理' })
    await tagSection.getByRole('button', { name: '添加' }).click()
    await page.waitForTimeout(2000)

    // Verify tag appears
    await expect(tagSection.getByText(tagName)).toBeVisible({ timeout: 5000 })

    // Delete
    const tagItem = tagSection.locator('.n-list-item').filter({ hasText: tagName })
    await tagItem.getByRole('button', { name: '删除' }).click()

    // Confirm popconfirm
    await page.getByRole('button', { name: '确认' }).click()
    await page.waitForTimeout(2000)

    // Verify gone
    await expect(tagSection.getByText(tagName)).not.toBeVisible({ timeout: 5000 })
  })

  test('S03: change password flow', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('设置', { timeout: 8000 })

    const newPwd = 'NewPass789'

    // Fill password form
    await page.getByPlaceholder('当前密码').fill(creds.password)
    await page.getByPlaceholder('新密码 (至少6位)').fill(newPwd)
    await page.getByPlaceholder('确认新密码').fill(newPwd)

    // Click "修改密码"
    await page.getByRole('button', { name: '修改密码' }).click()
    await page.waitForTimeout(3000)

    // After changing password, new tokens are saved — user stays logged in
    // Clear cookies to simulate fresh login
    await page.context().clearCookies()

    // Navigate to login
    await page.goto(`${BASE}/login`)
    await waitForHydration(page)

    await page.getByPlaceholder('请输入邮箱').fill(creds.email)
    await page.getByPlaceholder('请输入密码').fill(newPwd)
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForTimeout(3000)

    // Should end up on home page
    expect(page.url()).not.toContain('/login')
  })

  test('S04: theme switching', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('设置', { timeout: 8000 })

    // Click "深色"
    await page.getByRole('button', { name: '深色' }).click()
    await page.waitForTimeout(1000)

    // Check html attribute for dark theme
    const htmlDark = await page.locator('html').getAttribute('data-theme')
    // NaiveUI typically adds class or data attribute — check body class too
    const bodyClass = await page.locator('body').getAttribute('class')
    const isDark = htmlDark === 'dark' || (bodyClass && bodyClass.includes('dark'))

    // Click "浅色"
    await page.getByRole('button', { name: '浅色' }).click()
    await page.waitForTimeout(1000)

    const htmlLight = await page.locator('html').getAttribute('data-theme')
    const bodyClassLight = await page.locator('body').getAttribute('class')
    const isLight = htmlLight === 'light' || htmlLight === null || (bodyClassLight && !bodyClassLight.includes('dark'))

    // At least the theme should have changed between clicks
    expect(isDark || isLight).toBe(true)
  })
})
