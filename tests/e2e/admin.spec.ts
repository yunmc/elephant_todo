/**
 * E2E — Admin Panel: Login, Dashboard, Users, Products, Orders, Activities (A01–A18)
 *
 * Serial tests — logs in as admin once, reuses cookies for all tests.
 * Desktop viewport (1280×800) since admin panel has sidebar layout.
 *
 * Requires seed data: admin / 123456.
 * Strict assertions — every label, title, element checked exactly.
 */
import { test, expect, type Page } from '@playwright/test'
import { hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

type AdminCookieUser = {
  id: number
  username: string
  email: string
  role: string
}

let tokens: { adminToken: string; adminUser: AdminCookieUser }

/**
 * Login as admin via API once for serial tests.
 * This avoids browser boot/hydration flakiness in beforeAll hook.
 */
async function adminLoginOnce(): Promise<{ adminToken: string; adminUser: AdminCookieUser }> {
  const res = await fetch(`${BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => 'no body')
    throw new Error(`Admin login API failed (${res.status}): ${body}`)
  }
  const json = await res.json()
  const adminToken = json?.data?.token || ''
  const adminUser = json?.data?.admin
  if (!adminToken) throw new Error('Admin login succeeded but no token in response')
  if (!adminUser?.username) throw new Error('Admin login succeeded but no admin user in response')
  return { adminToken, adminUser }
}

async function injectAdminAuth(page: Page, t: typeof tokens) {
  const url = new URL(BASE)
  const adminUserValue = encodeURIComponent(JSON.stringify(t.adminUser))
  const cookies: Array<{ name: string; value: string; domain: string; path: string }> = [
    { name: 'adminToken', value: t.adminToken, domain: url.hostname, path: '/' },
    { name: 'adminUser', value: adminUserValue, domain: url.hostname, path: '/' },
  ]
  await page.context().addCookies(cookies)
}

async function gotoAdminDashboard(page: Page, t: typeof tokens) {
  await gotoAdminPage(page, t, '/admin')
}

async function gotoAdminPage(page: Page, t: typeof tokens, path: string) {
  const adminUserValue = encodeURIComponent(JSON.stringify(t.adminUser))
  await page.addInitScript(({ token, user }) => {
    document.cookie = `adminToken=${token}; path=/`
    if (user) document.cookie = `adminUser=${user}; path=/`
  }, { token: t.adminToken, user: adminUserValue })
  await page.goto(`${BASE}${path}`)
  await waitForHydration(page)
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

    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 8000 })
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
  })

  test('A03: empty fields trigger NaiveUI validation', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`${BASE}/admin/login`)
    await waitForHydration(page)

    await page.getByRole('button', { name: '登录' }).click()

    await expect(page.getByText('请输入用户名')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.n-form-item-feedback__line').getByText('请输入密码')).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10000 })
  })

  test('A04: unauthenticated access redirects to /admin/login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`${BASE}/admin`)
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10000 })
  })

  test('A05: dashboard shows exactly 5 stat cards with correct labels', async ({ page }) => {
    const [overviewResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/admin/stats/overview'), { timeout: 20000 }),
      gotoAdminDashboard(page, tokens),
    ])
    expect(overviewResp.ok(), `Dashboard overview API failed: ${overviewResp.status()}`).toBe(true)

    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.stat-card')).toHaveCount(5)

    const labels = ['总用户数', 'Premium 用户', '今日注册', '今日活跃', '付费转化率']
    for (const label of labels) {
      await expect(page.getByText(label)).toBeVisible()
    }

    const values = page.locator('.stat-value')
    for (let i = 0; i < 5; i++) {
      const text = (await values.nth(i).textContent())?.trim()
      expect(text).toBeDefined()
      expect(text!.length).toBeGreaterThan(0)
      expect(text).toMatch(/^[\d,.]+%?$/)
    }
  })

  test('A06: dashboard revenue & module usage sections', async ({ page }) => {
    await gotoAdminDashboard(page, tokens)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    await expect(page.getByText('收入概览')).toBeVisible()
    await expect(page.getByText('Premium 订阅收入')).toBeVisible()
    await expect(page.getByText('象币消费总额')).toBeVisible()
    await expect(page.getByText('模块使用量')).toBeVisible()
  })

  test('A07: dashboard trend chart with day selector', async ({ page }) => {
    await gotoAdminDashboard(page, tokens)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    await expect(page.getByText('注册趋势', { exact: false })).toBeVisible()

    const trendSection = page.locator('.section-card').filter({ hasText: '注册趋势' })
    await expect(trendSection.locator('.n-select')).toBeVisible()
  })

  test('A08: dashboard top products table with columns', async ({ page }) => {
    await gotoAdminDashboard(page, tokens)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    await expect(page.getByText('热门商品 Top 10')).toBeVisible()

    const productSection = page.locator('.section-card').filter({ hasText: '热门商品' })
    await expect(productSection.getByText('商品名')).toBeVisible()
    await expect(productSection.getByText('类型')).toBeVisible()
    await expect(productSection.getByText('销量')).toBeVisible()
    await expect(productSection.getByText('收入')).toBeVisible()
  })

  test('A09: sidebar shows admin username and role tag', async ({ page }) => {
    await gotoAdminDashboard(page, tokens)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    await expect(page.locator('.admin-name')).toHaveText('admin')
    await expect(page.locator('.sidebar-footer .n-tag')).toContainText('超级管理员')
  })

  test('A10: sidebar navigation to all 5 pages', async ({ page }) => {
    await gotoAdminDashboard(page, tokens)
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

  test('A11: users page renders table with data rows', async ({ page }) => {
    const [usersResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/admin/users'), { timeout: 15000 }),
      gotoAdminPage(page, tokens, '/admin/users'),
    ])
    expect(usersResp.ok(), `Users API failed: ${usersResp.status()}`).toBe(true)
    const body = await usersResp.json()
    expect(body.data?.users?.length, 'Users API should return at least 1 user').toBeGreaterThan(0)

    await expect(page.locator('.page-title')).toHaveText('用户管理', { timeout: 8000 })
    await expect(page.getByPlaceholder('搜索用户名或邮箱')).toBeVisible()
    await expect(page.locator('.n-data-table')).toBeVisible()

    await expect(page.locator('.n-data-table-tr--summary, .n-data-table tbody tr').first()).toBeVisible({ timeout: 5000 })
  })

  test('A12: users search input preserves exact value', async ({ page }) => {
    await gotoAdminPage(page, tokens, '/admin/users')
    await expect(page.locator('.page-title')).toHaveText('用户管理', { timeout: 8000 })

    const searchInput = page.getByPlaceholder('搜索用户名或邮箱')
    await searchInput.fill('nonexistent_user_xyz_12345')

    await expect(searchInput).toHaveValue('nonexistent_user_xyz_12345', { timeout: 3000 })
  })

  test('A13: products page shows create button and table', async ({ page }) => {
    const [productsResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/admin/products'), { timeout: 15000 }),
      gotoAdminPage(page, tokens, '/admin/products'),
    ])
    expect(productsResp.ok(), `Products API failed: ${productsResp.status()}`).toBe(true)

    await expect(page.locator('.page-title')).toHaveText('商品管理', { timeout: 8000 })
    await expect(page.getByRole('button', { name: /新建商品/ })).toBeVisible()
    await expect(page.locator('.n-data-table')).toBeVisible()
  })

  test('A14: create product via modal → product appears in table', async ({ page }) => {
    const productName = `E2E测试商品_${Date.now()}`

    await gotoAdminPage(page, tokens, '/admin/products')
    await expect(page.locator('.page-title')).toHaveText('商品管理', { timeout: 8000 })

    await page.getByRole('button', { name: /新建商品/ }).click()
    await expect(page.getByText('创建商品')).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder('商品名称').fill(productName)

    const [createResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/admin/products') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '创建', exact: true }).click(),
    ])
    expect(createResp.ok()).toBe(true)

    // Wait for modal to close
    await expect(page.getByText('创建商品')).not.toBeVisible({ timeout: 5000 })

    // Reload and wait for products API to complete
    const [_productsResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/admin/products') && resp.request().method() === 'GET', { timeout: 10000 }),
      page.reload(),
    ])
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toHaveText('商品管理', { timeout: 8000 })

    // Nav until we find the created item
    for (let i = 0; i < 15; i++) {
      if (await page.getByText(productName).isVisible().catch(() => false)) break
      const nextBtn = page.locator('.n-pagination-item--button').last()
      if (await nextBtn.isVisible().catch(() => false)) {
        const cls = await nextBtn.getAttribute('class').catch(() => '')
        if (cls?.includes('disabled')) break
        await Promise.all([
          page.waitForResponse(resp => resp.url().includes('/api/admin/products'), { timeout: 5000 }).catch(() => {}),
          nextBtn.dispatchEvent('click')
        ])
        await page.waitForTimeout(500)
      } else {
        break
      }
    }
    await expect(page.getByText(productName)).toBeVisible({ timeout: 5000 })
  })

  test('A15: orders page two tabs and status filter', async ({ page }) => {
    const [ordersResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/admin/orders'), { timeout: 15000 }),
      gotoAdminPage(page, tokens, '/admin/orders'),
    ])
    expect(ordersResp.ok(), `Orders API failed: ${ordersResp.status()}`).toBe(true)

    await expect(page.locator('.page-title')).toHaveText('订单查看', { timeout: 8000 })

    await expect(page.getByText('Premium 订单')).toBeVisible()
    await expect(page.getByText('商品购买记录')).toBeVisible()
    await expect(page.locator('.toolbar')).toBeVisible()

    // Switch to purchases tab
    await page.locator('.n-tabs-tab').filter({ hasText: '商品购买记录' }).click()
    await expect(page.locator('.toolbar')).not.toBeVisible({ timeout: 5000 })

    // Switch back to premium tab
    await page.locator('.n-tabs-tab').filter({ hasText: 'Premium 订单' }).click()
    await expect(page.locator('.toolbar')).toBeVisible({ timeout: 5000 })
  })

  test('A16: activities page shows create button and table', async ({ page }) => {
    const [activitiesResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/admin/activities'), { timeout: 15000 }),
      gotoAdminPage(page, tokens, '/admin/activities'),
    ])
    expect(activitiesResp.ok(), `Activities API failed: ${activitiesResp.status()}`).toBe(true)

    await expect(page.locator('.page-title')).toHaveText('活动配置', { timeout: 8000 })
    await expect(page.getByRole('button', { name: /创建活动/ })).toBeVisible()
    await expect(page.locator('.n-data-table')).toBeVisible()
  })

  test('A17: activity creation validates missing title', async ({ page }) => {
    await gotoAdminPage(page, tokens, '/admin/activities')
    await expect(page.locator('.page-title')).toHaveText('活动配置', { timeout: 8000 })

    await page.getByRole('button', { name: /创建活动/ }).click()
    await expect(page.getByRole('heading', { name: '创建活动', exact: true })).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: '创建', exact: true }).click()

    // Modal remains open (validation prevented close)
    await expect(page.getByRole('heading', { name: '创建活动', exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('A18: logout redirects to /admin/login', async ({ page }) => {
    await gotoAdminDashboard(page, tokens)
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 10000 })

    await page.getByText('退出登录').click()

    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 8000 })
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
  })
})
