/**
 * E2E — Auth flow (A01–A20) + PWA basics (W01–W02)
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

  test('A08: login page navigation links work', async ({ page }) => {
    // Start at login page
    await page.goto(`${BASE}/login`)
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()

    // Click "没有账号？注册" link
    await page.getByText('没有账号？注册').click()
    await expect(page).toHaveURL(/\/register/, { timeout: 5000 })
    await expect(page.getByRole('button', { name: '注册' })).toBeVisible()

    // Click "已有账号？登录" link back
    await page.getByText('已有账号？登录').click()
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
  })

  test('A09: register with mismatched passwords stays on page', async ({ page }) => {
    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2, 6)
    await page.goto(`${BASE}/register`)
    await waitForHydration(page)
    await page.getByPlaceholder('请输入用户名').fill(`mismatch_${rand}`)
    await page.getByPlaceholder('请输入邮箱').fill(`mismatch_${ts}_${rand}@test.com`)
    await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
    await page.getByPlaceholder('请再次输入密码').fill('DifferentPassword789')
    await page.getByRole('button', { name: '注册' }).click()
    await page.waitForTimeout(2000)

    // Should stay on register page (passwords don't match)
    expect(page.url()).toContain('/register')
  })

  test('A10: reset password page without token shows error', async ({ page }) => {
    await page.goto(`${BASE}/reset-password`)
    await waitForHydration(page)

    // Should show error state "无效的重置链接"
    await expect(page.getByText('无效的重置链接')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('缺少重置令牌')).toBeVisible()
    // Should show link to resend reset email
    await expect(page.getByRole('button', { name: '重新发送重置邮件' })).toBeVisible()
  })

  test('A11: reset password form validates password rules', async ({ page }) => {
    await page.goto(`${BASE}/reset-password?token=fake-token`)
    await waitForHydration(page)

    // Form should be visible (token present, no error state)
    await expect(page.getByPlaceholder('请输入新密码（至少6位）')).toBeVisible({ timeout: 5000 })
    await expect(page.getByPlaceholder('请再次输入新密码')).toBeVisible()

    // Submit with mismatched passwords
    await page.getByPlaceholder('请输入新密码（至少6位）').fill('NewPass123')
    await page.getByPlaceholder('请再次输入新密码').fill('Different456')
    await page.getByRole('button', { name: '重置密码' }).click()
    await page.waitForTimeout(1000)

    // Should still be on reset-password page (validation failed)
    expect(page.url()).toContain('/reset-password')
  })

  test('A12: forgot password empty submit shows warning', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`)
    await waitForHydration(page)
    await expect(page.getByPlaceholder('请输入注册邮箱')).toBeVisible({ timeout: 5000 })

    // Click submit without entering email
    await page.getByRole('button', { name: '发送重置链接' }).click()
    await page.waitForTimeout(1000)

    // Should still be on forgot-password page (not showing success)
    expect(page.url()).toContain('/forgot-password')
    // The success state "邮件已发送" should NOT be visible
    await expect(page.getByText('邮件已发送')).not.toBeVisible({ timeout: 2000 })
  })

  test('A13: direct login with valid credentials redirects to home', async ({ page }) => {
    // Register a fresh user first
    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2, 6)
    const email = `login_${ts}_${rand}@test.com`
    const password = 'Test123456'
    await page.goto(`${BASE}/register`)
    await waitForHydration(page)
    await page.getByPlaceholder('请输入用户名').fill(`login_${rand}`)
    await page.getByPlaceholder('请输入邮箱').fill(email)
    await page.getByPlaceholder('请输入密码（至少6位）').fill(password)
    await page.getByPlaceholder('请再次输入密码').fill(password)
    await page.getByRole('button', { name: '注册' }).click()
    await page.waitForURL('**/', { timeout: 15000 })

    // Clear cookies to simulate fresh session
    await page.context().clearCookies()

    // Now login directly
    await page.goto(`${BASE}/login`)
    await waitForHydration(page)
    await page.getByPlaceholder('请输入邮箱').fill(email)
    await page.getByPlaceholder('请输入密码').fill(password)
    await page.getByRole('button', { name: '登录' }).click()

    // Should redirect to home
    await page.waitForURL('**/', { timeout: 10000 })
    expect(page.url()).not.toContain('/login')
  })

  test('A14: login empty submit stays on login page', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await waitForHydration(page)
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible({ timeout: 5000 })

    // Click login without filling any field
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForTimeout(2000)

    // Should still be on login page (NaiveUI form validation prevents submit)
    expect(page.url()).toContain('/login')
  })

  test('A15: register with duplicate email shows error', async ({ page }) => {
    // Register a user first via UI
    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2, 6)
    const email = `dup_${ts}_${rand}@test.com`
    await page.goto(`${BASE}/register`)
    await waitForHydration(page)
    await page.getByPlaceholder('请输入用户名').fill(`dup_${rand}`)
    await page.getByPlaceholder('请输入邮箱').fill(email)
    await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
    await page.getByPlaceholder('请再次输入密码').fill('Test123456')
    await page.getByRole('button', { name: '注册' }).click()
    // Wait for successful registration (redirect to home)
    await page.waitForURL('**/', { timeout: 15000 })

    // Clear cookies to simulate fresh session
    await page.context().clearCookies()

    // Try to register again with the same email
    await page.goto(`${BASE}/register`)
    await waitForHydration(page)
    await page.getByPlaceholder('请输入用户名').fill(`dup2_${rand}`)
    await page.getByPlaceholder('请输入邮箱').fill(email)
    await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
    await page.getByPlaceholder('请再次输入密码').fill('Test123456')
    await page.getByRole('button', { name: '注册' }).click()
    await page.waitForTimeout(3000)

    // Should stay on register page (duplicate email error)
    expect(page.url()).toContain('/register')
  })

  test('A18: register with short password shows validation', async ({ page }) => {
    await page.goto(`${BASE}/register`)
    await waitForHydration(page)
    await page.getByPlaceholder('请输入密码（至少6位）').fill('Ab1')
    // Blur to trigger NaiveUI validation
    await page.getByPlaceholder('请输入用户名').click()
    await page.waitForTimeout(1000)
    await expect(page.getByText('密码长度不能少于6位')).toBeVisible({ timeout: 5000 })
  })

  test('A19: register with invalid email shows validation', async ({ page }) => {
    await page.goto(`${BASE}/register`)
    await waitForHydration(page)
    await page.getByPlaceholder('请输入邮箱').fill('not-an-email')
    // Blur to trigger validation
    await page.getByPlaceholder('请输入用户名').click()
    await page.waitForTimeout(1000)
    await expect(page.getByText('请输入有效的邮箱地址')).toBeVisible({ timeout: 5000 })
  })

  test('A20: forgot password with valid email submits', async ({ page }) => {
    await page.goto(`${BASE}/forgot-password`)
    await waitForHydration(page)
    await page.getByPlaceholder('请输入注册邮箱').fill('test@example.com')
    await page.getByRole('button', { name: '发送重置链接' }).click()
    // API always returns success (SMTP errors caught silently), but rate limit may fire
    // Use .first() to avoid strict-mode violation when multiple messages appear
    await expect(
      page.getByText('邮件已发送')
        .or(page.getByText('请求过于频繁'))
        .or(page.getByText('发送失败'))
        .first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('A17: logged-in user visiting /login is redirected to home', async ({ page }) => {
    // Register a user via UI and stay logged in
    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2, 6)
    await page.goto(`${BASE}/register`)
    await waitForHydration(page)
    await page.getByPlaceholder('请输入用户名').fill(`redir_${rand}`)
    await page.getByPlaceholder('请输入邮箱').fill(`redir_${ts}_${rand}@test.com`)
    await page.getByPlaceholder('请输入密码（至少6位）').fill('Test123456')
    await page.getByPlaceholder('请再次输入密码').fill('Test123456')
    await page.getByRole('button', { name: '注册' }).click()
    // Wait for successful registration (redirect to home — user is now logged in)
    await page.waitForURL('**/', { timeout: 15000 })

    // Navigate to /login — should be redirected to home
    await page.goto(`${BASE}/login`)
    await page.waitForTimeout(3000)
    expect(page.url()).not.toContain('/login')
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
