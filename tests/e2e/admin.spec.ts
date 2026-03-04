/**
 * E2E — Admin Panel: Login, Dashboard, Users, Products, Orders, Activities (A01–A18)
 *
 * Serial tests — logs in as admin once, reuses cookies for all tests.
 * Desktop viewport (1280×800) since admin panel has sidebar layout.
 *
 * Requires seed data: admin / 123456.
 * Strict assertions — every label, title, element checked exactly.
 */
import { test, expect, chromium, type Page } from '@playwright/test'
import { hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

let tokens: { adminToken: string; adminUser: string }

/**
 * Login as admin via real UI in a temp browser, extract cookies.
 */
async function adminLoginOnce(): Promise<{ adminToken: string; adminUser: string }> {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/admin/login`)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('__nuxt')
        return el && (el as any).__vue_app__
      },
      { timeout: 15000 },
    )
    await page.getByPlaceholder('请输入管理员用户名').fill('admin')
    await page.getByPlaceholder('请输入密码').fill('123456')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForURL('**/admin', { timeout: 15000 })

    const cookies = await ctx.cookies()
    const adminToken = cookies.find(c => c.name === 'adminToken')?.value ?? ''
    const adminUser = cookies.find(c => c.name === 'adminUser')?.value ?? ''
    if (!adminToken) throw new Error('Admin login succeeded but adminToken cookie not found')
    return { adminToken, adminUser }
  } finally {
    await browser.close()
  }
}

/**
 * Inject admin auth cookies so the middleware allows access.
 */
async function injectAdminAuth(page: Page, t: typeof tokens) {
  const url = new URL(BASE)
  const cookies: Array<{ name: string; value: string; domain: string; path: string }> = [
    { name: 'adminToken', value: t.adminToken, domain: url.hostname, path: '/' },
  ]
  if (t.adminUser) {
    cookies.push({ name: 'adminUser', value: t.adminUser, domain: url.hostname, path: '/' })
  }
  await page.context().addCookies(cookies)
}

test.describe.serial('Admin Panel', () => {
  test.beforeAll(async () => {
    tokens = await adminLoginOnce()
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await hideDevToolsOverlay(page)
    await injectAdminAuth(page, tokens)
  })

  // ════════════════════════════════════════════
  // Login & Auth
  // ════════════════════════════════════════════

  test('A01: login page renders exact elements', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`${BASE}/admin/login`)
    await waitForHydration(page)

    await expect(page.getByText('Elephant Admin')).toBeVisible()
    await expect(page.getByText('管理后台登录')).toBeVisible()
    await expect(page.getByPlaceholder('请输入管理员用户名')).toBeVisible()
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
    await expect(page.locator('.logo-icon')).toHaveText('🐘')
  })

  test('A02: wrong password stays on login page', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`${BASE}/admin/login`)
    await waitForHydration(page)

    await page.getByPlaceholder('请输入管理员用户名').fill('admin')
    await page.getByPlaceholder('请输入密码').fill('wrongpassword999')
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForTimeout(3000)

    expect(page.url()).toContain('/admin/login')
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
  })

  test('A03: empty fields trigger NaiveUI validation', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`${BASE}/admin/login`)
    await waitForHydration(page)

    // Click login without filling anything
    await page.getByRole('button', { name: '登录' }).click()
    await page.waitForTimeout(1000)

    // NaiveUI form validation shows error messages below each field
    await expect(page.getByText('请输入用户名')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('请输入密码')).toBeVisible({ timeout: 3000 })
    expect(page.url()).toContain('/admin/login')
  })

  test('A04: unauthenticated access redirects to /admin/login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`${BASE}/admin`)
    await page.waitForTimeout(3000)
    expect(page.url()).toContain('/admin/login')
  })

  // ════════════════════════════════════════════
  // Dashboard
  // ════════════════════════════════════════════

  test('A05: dashboard shows exactly 5 stat cards with correct labels', async ({ page }) => {
    await page.goto(`${BASE}/admin`)
    await waitForHydration(page)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    // Exactly 5 stat cards
    await expect(page.locator('.stat-card')).toHaveCount(5)

    // All 5 labels present
    const labels = ['总用户数', 'Premium 用户', '今日注册', '今日活跃', '付费转化率']
    for (const label of labels) {
      await expect(page.getByText(label)).toBeVisible()
    }

    // Each .stat-value is non-empty
    const values = page.locator('.stat-value')
    for (let i = 0; i < 5; i++) {
      const text = (await values.nth(i).textContent())?.trim()
      expect(text).toBeDefined()
      expect(text!.length).toBeGreaterThan(0)
    }
  })

  test('A06: dashboard revenue & module usage sections', async ({ page }) => {
    await page.goto(`${BASE}/admin`)
    await waitForHydration(page)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    // Revenue section
    await expect(page.getByText('收入概览')).toBeVisible()
    await expect(page.getByText('Premium 订阅收入')).toBeVisible()
    await expect(page.getByText('象币消费总额')).toBeVisible()

    // Module usage section
    await expect(page.getByText('模块使用量')).toBeVisible()
  })

  test('A07: dashboard trend chart with day selector', async ({ page }) => {
    await page.goto(`${BASE}/admin`)
    await waitForHydration(page)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    await expect(page.getByText('注册趋势', { exact: false })).toBeVisible()

    // Day selector in trend section
    const trendSection = page.locator('.section-card').filter({ hasText: '注册趋势' })
    await expect(trendSection.locator('.n-select')).toBeVisible()
  })

  test('A08: dashboard top products table with columns', async ({ page }) => {
    await page.goto(`${BASE}/admin`)
    await waitForHydration(page)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    await expect(page.getByText('热门商品 Top 10')).toBeVisible()

    const productSection = page.locator('.section-card').filter({ hasText: '热门商品' })
    await expect(productSection.getByText('商品名')).toBeVisible()
    await expect(productSection.getByText('类型')).toBeVisible()
    await expect(productSection.getByText('销量')).toBeVisible()
    await expect(productSection.getByText('收入')).toBeVisible()
  })

  // ════════════════════════════════════════════
  // Sidebar
  // ════════════════════════════════════════════

  test('A09: sidebar shows admin username and role tag', async ({ page }) => {
    await page.goto(`${BASE}/admin`)
    await waitForHydration(page)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    await expect(page.locator('.admin-name')).toHaveText('admin')
    await expect(page.locator('.sidebar-footer .n-tag')).toContainText('超级管理员')
  })

  test('A10: sidebar navigation to all 5 pages', async ({ page }) => {
    await page.goto(`${BASE}/admin`)
    await waitForHydration(page)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    const pages = [
      { text: '用户管理', url: '/admin/users', title: '用户管理' },
      { text: '商品管理', url: '/admin/products', title: '商品管理' },
      { text: '订单查看', url: '/admin/orders', title: '订单查看' },
      { text: '活动配置', url: '/admin/activities', title: '活动配置' },
      { text: '数据统计', url: '/admin', title: '数据统计' },
    ]

    for (const p of pages) {
      await page.locator('.nav-item').filter({ hasText: p.text }).click()
      await page.waitForURL(`**${p.url}`, { timeout: 5000 })
      await expect(page.locator('.page-title')).toHaveText(p.title)
    }
  })

  // ════════════════════════════════════════════
  // Users
  // ════════════════════════════════════════════

  test('A11: users page renders table and toolbar', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toHaveText('用户管理', { timeout: 8000 })

    await expect(page.getByPlaceholder('搜索用户名或邮箱')).toBeVisible()
    await expect(page.locator('.n-data-table')).toBeVisible()
  })

  test('A12: users search input preserves exact value', async ({ page }) => {
    await page.goto(`${BASE}/admin/users`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toHaveText('用户管理', { timeout: 8000 })

    const searchInput = page.getByPlaceholder('搜索用户名或邮箱')
    await searchInput.fill('nonexistent_user_xyz_12345')
    await page.waitForTimeout(1000)

    await expect(searchInput).toHaveValue('nonexistent_user_xyz_12345')
  })

  // ════════════════════════════════════════════
  // Products
  // ════════════════════════════════════════════

  test('A13: products page shows create button and table', async ({ page }) => {
    await page.goto(`${BASE}/admin/products`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toHaveText('商品管理', { timeout: 8000 })

    await expect(page.getByRole('button', { name: /新建商品/ })).toBeVisible()
    await expect(page.locator('.n-data-table')).toBeVisible()
  })

  test('A14: create product via modal → product appears in table', async ({ page }) => {
    const productName = `E2E测试商品_${Date.now()}`

    await page.goto(`${BASE}/admin/products`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toHaveText('商品管理', { timeout: 8000 })

    // Open create modal
    await page.getByRole('button', { name: /新建商品/ }).click()
    await page.waitForTimeout(500)
    await expect(page.getByText('创建商品')).toBeVisible()

    // Fill product name (type defaults to skin, price defaults to 0)
    await page.getByPlaceholder('商品名称').fill(productName)

    // Submit
    await page.getByRole('button', { name: '创建', exact: true }).click()
    await page.waitForTimeout(3000)

    // Modal should close
    await expect(page.getByText('创建商品')).not.toBeVisible({ timeout: 5000 })

    // Exact product name must appear in table
    await expect(page.getByText(productName)).toBeVisible({ timeout: 5000 })
  })

  // ════════════════════════════════════════════
  // Orders
  // ════════════════════════════════════════════

  test('A15: orders page two tabs and status filter', async ({ page }) => {
    await page.goto(`${BASE}/admin/orders`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toHaveText('订单查看', { timeout: 8000 })

    // Both tabs visible
    await expect(page.getByText('Premium 订单')).toBeVisible()
    await expect(page.getByText('商品购买记录')).toBeVisible()

    // Status filter visible on premium tab
    await expect(page.locator('.toolbar')).toBeVisible()

    // Switch to purchases tab
    await page.locator('.n-tabs-tab').filter({ hasText: '商品购买记录' }).click()
    await page.waitForTimeout(1000)

    // Status filter should be hidden on purchases tab
    await expect(page.locator('.toolbar')).not.toBeVisible()

    // Switch back to premium tab
    await page.locator('.n-tabs-tab').filter({ hasText: 'Premium 订单' }).click()
    await page.waitForTimeout(1000)

    // Status filter visible again
    await expect(page.locator('.toolbar')).toBeVisible()
  })

  // ════════════════════════════════════════════
  // Activities
  // ════════════════════════════════════════════

  test('A16: activities page shows create button and table', async ({ page }) => {
    await page.goto(`${BASE}/admin/activities`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toHaveText('活动配置', { timeout: 8000 })

    await expect(page.getByRole('button', { name: /创建活动/ })).toBeVisible()
    await expect(page.locator('.n-data-table')).toBeVisible()
  })

  test('A17: activity creation validates missing title', async ({ page }) => {
    await page.goto(`${BASE}/admin/activities`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toHaveText('活动配置', { timeout: 8000 })

    // Open create modal
    await page.getByRole('button', { name: /创建活动/ }).click()
    await page.waitForTimeout(500)
    await expect(page.getByText('创建活动')).toBeVisible()

    // Submit without filling title
    await page.getByRole('button', { name: '创建', exact: true }).click()
    await page.waitForTimeout(1500)

    // Modal remains open (validation prevented close)
    await expect(page.getByText('创建活动')).toBeVisible()
  })

  // ════════════════════════════════════════════
  // Logout (must be last)
  // ════════════════════════════════════════════

  test('A18: logout redirects to /admin/login', async ({ page }) => {
    await page.goto(`${BASE}/admin`)
    await waitForHydration(page)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    // Click logout in sidebar footer
    await page.getByText('退出登录').click()
    await page.waitForTimeout(2000)

    expect(page.url()).toContain('/admin/login')
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
  })
})
