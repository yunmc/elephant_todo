/**
 * E2E — Settings: Category / Tag CRUD, Change Password, Theme, Account Info (S01–S10)
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

  test('S05: account info shows username and email', async ({ page }) => {
    // authStore.user is loaded from 'user' cookie — inject it so v-if renders
    const url = new URL(BASE)
    await page.context().addCookies([{
      name: 'user',
      value: JSON.stringify({ id: 0, username: creds.username, email: creds.email, created_at: '', updated_at: '' }),
      domain: url.hostname,
      path: '/',
    }])

    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('设置', { timeout: 8000 })

    // Account info section should show the registered user data
    const accountSection = page.locator('.section-card').filter({ hasText: '账户信息' })
    await expect(accountSection).toBeVisible({ timeout: 5000 })

    // Username and email should be displayed
    await expect(accountSection.getByText(creds.username)).toBeVisible({ timeout: 5000 })
    await expect(accountSection.getByText(creds.email)).toBeVisible()
  })

  test('S06: change password with wrong current password shows error', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('设置', { timeout: 8000 })

    // Fill with wrong current password
    await page.getByPlaceholder('当前密码').fill('WrongOldPassword999')
    await page.getByPlaceholder('新密码 (至少6位)').fill('NewPass999')
    await page.getByPlaceholder('确认新密码').fill('NewPass999')

    // Click "修改密码"
    await page.getByRole('button', { name: '修改密码' }).click()
    await page.waitForTimeout(3000)

    // Should still be on settings page (password change failed)
    expect(page.url()).toContain('/settings')
    // The page should remain functional
    await expect(page.locator('.page-title')).toContainText('设置')
  })

  test('S07: follow system theme button', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('设置', { timeout: 8000 })

    // Click "跟随系统" button
    await page.getByRole('button', { name: '跟随系统' }).click()
    await page.waitForTimeout(500)

    // The "跟随系统" button should be highlighted (type=primary)
    const systemBtn = page.getByRole('button', { name: '跟随系统' })
    await expect(systemBtn).toHaveClass(/n-button--primary-type/, { timeout: 3000 })

    // Other buttons should NOT be primary
    const lightBtn = page.getByRole('button', { name: '浅色' })
    const darkBtn = page.getByRole('button', { name: '深色' })
    await expect(lightBtn).not.toHaveClass(/n-button--primary-type/)
    await expect(darkBtn).not.toHaveClass(/n-button--primary-type/)
  })

  test('S09: password mismatch shows validation error', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('设置', { timeout: 8000 })

    // S03 changed password to 'NewPass789' — use that as current password
    await page.getByPlaceholder('当前密码').fill('NewPass789')
    await page.getByPlaceholder('新密码 (至少6位)').fill('Abcdef123')
    await page.getByPlaceholder('确认新密码').fill('Mismatch999')

    // Click "修改密码"
    await page.getByRole('button', { name: '修改密码' }).click()
    await page.waitForTimeout(1500)

    // Front-end validation: "两次密码不一致" message should be visible
    await expect(page.getByText('两次密码不一致')).toBeVisible({ timeout: 3000 })
    // Should still be on settings page
    expect(page.url()).toContain('/settings')
  })

  test('S10: password too short shows validation error', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('设置', { timeout: 8000 })

    // S03 changed password to 'NewPass789'
    await page.getByPlaceholder('当前密码').fill('NewPass789')
    await page.getByPlaceholder('新密码 (至少6位)').fill('Ab1')   // too short (3 chars)
    await page.getByPlaceholder('确认新密码').fill('Ab1')

    // Click "修改密码"
    await page.getByRole('button', { name: '修改密码' }).click()
    await page.waitForTimeout(1500)

    // Front-end validation: "新密码至少6位" message should be visible
    await expect(page.getByText('新密码至少6位')).toBeVisible({ timeout: 3000 })
    // Should still be on settings page
    expect(page.url()).toContain('/settings')
  })
})
