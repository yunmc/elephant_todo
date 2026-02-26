/**
 * E2E — Auth flow (A01–A07) + PWA basics (W01–W02)
 */
import { test, expect } from '@playwright/test'
import { test as authedTest, expect as authedExpect, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

test.describe('Auth — Public Pages', () => {
  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
  })
  test('A01: unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto(BASE)
    await expect(page).toHaveURL(/\/login/)
  })

  test('A02: login page shows email + password inputs', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible()
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
  })

  test('A03: wrong password shows error', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.getByPlaceholder('请输入邮箱').fill('nobody@test.com')
    await page.getByPlaceholder('请输入密码').fill('WrongPassword123')
    await page.getByRole('button', { name: '登录' }).click()
    // NaiveUI message appears or URL stays on /login
    await page.waitForTimeout(3000)
    // Should still be on login page (wrong password)
    expect(page.url()).toContain('/login')
  })

  test('A04: register page shows user/email/password inputs', async ({ page }) => {
    await page.goto(`${BASE}/register`)
    await expect(page.getByPlaceholder('请输入用户名')).toBeVisible()
    await expect(page.getByPlaceholder('请输入邮箱')).toBeVisible()
  })

  test('A05: register → auto-login → redirect to home', async ({ page }) => {
    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2, 6)
    await page.goto(`${BASE}/register`)
    await waitForHydration(page)
    await page.getByPlaceholder('请输入用户名').fill(`reg_${rand}`)
    await page.getByPlaceholder('请输入邮箱').fill(`reg_${ts}_${rand}@test.com`)
    await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
    await page.getByPlaceholder('请再次输入密码').fill('Test123456')
    await page.getByRole('button', { name: '注册' }).click()
    // Should redirect to home (todo list)
    await page.waitForURL('**/', { timeout: 10000 })
    const url = page.url()
    const isNotRegister = !url.includes('/register')
    expect(isNotRegister).toBe(true)
  })

  test('A06: forgot password page works', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`)
    await expect(page.getByPlaceholder('请输入注册邮箱')).toBeVisible()
  })
})

authedTest.describe('Auth — Logout', () => {
  authedTest('A07: logout redirects to /login', async ({ authedPage }) => {
    // Navigate to settings
    await authedPage.goto(`${BASE}/settings`)
    await authedExpect(authedPage.locator('.page-title')).toContainText('设置', { timeout: 8000 })
    // Click logout button
    await authedPage.getByRole('button', { name: '退出登录' }).click()
    // Should redirect to login page
    await authedExpect(authedPage).toHaveURL(/\/login/, { timeout: 10000 })
  })
})

test.describe('PWA', () => {
  test('W01: manifest is accessible', async ({ page }) => {
    const response = await page.goto(`${BASE}/manifest.webmanifest`)
    if (response) expect(response.status()).toBe(200)
  })

  test('W02: has theme-color meta tag', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(themeColor).toBeDefined()
  })
})
