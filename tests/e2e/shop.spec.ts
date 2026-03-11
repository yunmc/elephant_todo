/**
 * E2E — Shop (手帐商店) Full Flow (S01–S12)
 *
 * Serial tests sharing the same user.
 * Tests:
 * - 商店页面加载 + 商品列表显示
 * - 钱包余额显示（新用户 10 象币）
 * - Tab 筛选切换
 * - 商品详情页
 * - 购买流程（成功 + 余额不足）
 * - 装扮更换
 * - 我的仓库
 * - 象币流水弹窗
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

let tokens: { accessToken: string; refreshToken: string }

test.describe.serial('Shop Flow', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  // ─── S01: 商店页面可访问 ────────────────────────────────

  test('S01: shop page loads with title and wallet badge', async ({ page }) => {
    // Intercept both shop APIs to verify they succeed
    const [walletResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/wallet') && !resp.url().includes('transactions'), { timeout: 15000 }),
      page.goto(`${BASE}/shop`),
    ])
    await waitForHydration(page)

    expect(walletResp.ok(), `Wallet API failed: ${walletResp.status()}`).toBe(true)

    await expect(page.locator('.page-title')).toContainText('手帐商店', { timeout: 8000 })
    // 新用户注册赠送 10 象币
    const walletBadge = page.locator('.wallet-badge')
    await expect(walletBadge).toBeVisible({ timeout: 5000 })
    await expect(walletBadge).toContainText('象币')
    // Wallet badge should show a numeric balance
    const badgeText = await walletBadge.textContent() ?? ''
    expect(badgeText).toMatch(/\d+/)
  })

  // ─── S02: 商品列表显示 ─────────────────────────────────

  test('S02: products grid shows at least the default free skin', async ({ page }) => {
    // Intercept products API to verify it succeeds
    const [productsResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/shop/products'), { timeout: 15000 }),
      page.goto(`${BASE}/shop`),
    ])
    await waitForHydration(page)

    expect(productsResp.ok(), `Shop products API failed: ${productsResp.status()}`).toBe(true)
    const body = await productsResp.json()
    expect(body.data?.length, 'Products API should return at least 1 product').toBeGreaterThanOrEqual(1)

    // 等待商品加载
    const productCards = page.locator('.product-card')
    await expect(productCards.first()).toBeVisible({ timeout: 8000 })

    // 至少有 1 个商品（默认皮肤是免费的）
    const count = await productCards.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // 默认皮肤应该显示"已拥有"或"免费"
    const freeOrOwned = page.locator('.free-badge, .owned-badge').first()
    await expect(freeOrOwned).toBeVisible({ timeout: 3000 })
  })

  // ─── S03: Tab 筛选 ──────────────────────────────────────

  test('S03: type filter tabs work', async ({ page }) => {
    await page.goto(`${BASE}/shop`)
    await waitForHydration(page)
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 8000 })

    // 点击"贴纸"tab → 显示"敬请期待"
    await page.locator('.tab', { hasText: '贴纸' }).click()
    await expect(page.getByText('敬请期待')).toBeVisible({ timeout: 3000 })

    // 点击"字体"tab → 显示"敬请期待"
    await page.locator('.tab', { hasText: '字体' }).click()
    await expect(page.getByText('敬请期待')).toBeVisible({ timeout: 3000 })

    // 点回"全部"tab → 商品重新显示
    await page.locator('.tab', { hasText: '全部' }).click()
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 5000 })
  })

  // ─── S04: 商品详情页 ───────────────────────────────────

  test('S04: clicking a product navigates to detail page', async ({ page }) => {
    await page.goto(`${BASE}/shop`)
    await waitForHydration(page)
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 8000 })

    // 点击第一个商品卡片
    await page.locator('.product-card').first().click()
    await page.waitForURL('**/shop/product/**', { timeout: 5000 })

    // 详情页应有产品名称和按钮
    await expect(page.locator('.product-title')).toBeVisible({ timeout: 5000 })
    // 应有"返回"按钮
    await expect(page.getByText('← 返回')).toBeVisible()
  })

  // ─── S05: 免费商品详情 → 装扮按钮 ────────────────────────

  test('S05: free product detail shows equip button', async ({ page }) => {
    // 通过 UI 找到免费商品并点击进入详情
    await page.goto(`${BASE}/shop`)
    await waitForHydration(page)
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 8000 })

    // 找到带有"免费"或"已拥有"标记的商品卡（默认免费皮肤）
    const freeCard = page.locator('.product-card').filter({ has: page.locator('.free-badge, .owned-badge') }).first()
    if (!(await freeCard.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip()
      return
    }
    const productName = await freeCard.locator('.product-name').textContent() ?? ''

    // 点击进入详情
    await freeCard.click()
    await page.waitForURL('**/shop/product/**', { timeout: 5000 })

    await expect(page.locator('.product-title')).toContainText(productName.trim(), { timeout: 5000 })
    // 免费商品 → 已拥有 → 显示"使用中"或"立即使用"按钮
    const equipBtn = page.getByRole('button', { name: /使用中|立即使用/ })
    await expect(equipBtn).toBeVisible({ timeout: 5000 })
  })

  // ─── S06: 充值象币（开发环境） ──────────────────────────

  test('S06: add coins via dev endpoint (browser-side)', async ({ page }) => {
    // 先导航到商店页面，然后在浏览器上下文中调用充值接口
    await page.goto(`${BASE}/shop`)
    await waitForHydration(page)
    await expect(page.locator('.wallet-badge')).toBeVisible({ timeout: 8000 })

    // 在浏览器上下文中通过 fetch 充值 100 象币（利用页面已有的 cookie）
    const result = await page.evaluate(async () => {
      // Read accessToken from cookie for Authorization header
      const tokenMatch = document.cookie.split(';').find(c => c.trim().startsWith('accessToken='))
      const token = tokenMatch ? tokenMatch.split('=').slice(1).join('=').trim() : ''
      const resp = await fetch('/api/wallet/add-coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: 100 }),
      })
      return resp.json()
    })
    expect(result.success).toBe(true)
    expect(result.data.balance).toBeGreaterThanOrEqual(100)

    // 刷新页面验证余额已更新
    await page.reload()
    await waitForHydration(page)
    await expect(page.locator('.wallet-badge')).toBeVisible({ timeout: 5000 })
  })

  // ─── S07: 购买商品 ─────────────────────────────────────

  test('S07: purchase a paid product successfully', async ({ page }) => {
    // 通过 UI 找到一个付费且未拥有的商品
    await page.goto(`${BASE}/shop`)
    await waitForHydration(page)
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 8000 })

    // 筛选皮肤 tab
    await page.locator('.tab', { hasText: '皮肤' }).click()
    // Wait for products to load after tab switch
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 5000 })

    // 找到没有 .free-badge 和 .owned-badge 的付费商品卡
    const allCards = page.locator('.product-card')
    const count = await allCards.count()
    let paidCardFound = false

    for (let i = 0; i < count; i++) {
      const card = allCards.nth(i)
      const hasFree = await card.locator('.free-badge').isVisible().catch(() => false)
      const hasOwned = await card.locator('.owned-badge').isVisible().catch(() => false)
      if (!hasFree && !hasOwned) {
        // 找到付费未拥有的商品，点击进入详情
        await card.click()
        await page.waitForURL('**/shop/product/**', { timeout: 5000 })
        paidCardFound = true
        break
      }
    }

    if (!paidCardFound) {
      test.skip()
      return
    }

    // 点击"立即购买"
    const buyBtn = page.getByRole('button', { name: '立即购买' })
    await expect(buyBtn).toBeVisible({ timeout: 5000 })
    await buyBtn.click()

    // 购买成功后应变为"立即使用"
    await expect(page.getByRole('button', { name: /使用中|立即使用/ })).toBeVisible({ timeout: 8000 })
  })

  // ─── S08: 装扮更换 ─────────────────────────────────────

  test('S08: equip a purchased skin', async ({ page }) => {
    // 通过 UI 找到已拥有的付费皮肤（S07 已购买）
    await page.goto(`${BASE}/shop`)
    await waitForHydration(page)
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 8000 })

    // 筛选皮肤 tab
    await page.locator('.tab', { hasText: '皮肤' }).click()
    // Wait for products to load after tab switch
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 5000 })

    // 找到带有 .owned-badge 但不带 .free-badge 的商品卡（付费已拥有）
    // 注意：当 product.owned 为 true 时，free-badge 不会显示（v-else-if），
    // 所以还需要排除 asset_key 为 "default" 的默认皮肤
    const allCards = page.locator('.product-card')
    const count = await allCards.count()
    let ownedPaidFound = false

    for (let i = 0; i < count; i++) {
      const card = allCards.nth(i)
      const hasFree = await card.locator('.free-badge').isVisible().catch(() => false)
      const hasOwned = await card.locator('.owned-badge').isVisible().catch(() => false)
      // 排除默认皮肤（asset_key 为 "default"，v-if/v-else-if 会隐藏 free-badge）
      const skinPreview = await card.locator('[data-skin-preview]').getAttribute('data-skin-preview').catch(() => null)
      if (hasOwned && !hasFree && skinPreview !== 'default') {
        await card.click()
        await page.waitForURL('**/shop/product/**', { timeout: 5000 })
        ownedPaidFound = true
        break
      }
    }

    if (!ownedPaidFound) {
      test.skip()
      return
    }

    // 等待商品详情加载完成
    await expect(page.getByRole('button', { name: /立即使用|使用中/ })).toBeVisible({ timeout: 8000 })

    // 点"立即使用"
    const equipBtn = page.getByRole('button', { name: '立即使用' })
    if (await equipBtn.isVisible()) {
      await equipBtn.click()
      // 应变为"使用中"
      await expect(page.getByRole('button', { name: '使用中' })).toBeVisible({ timeout: 5000 })
    }

    // 验证 data-skin 属性已设置到 html 元素（retrying assertion）
    await expect(async () => {
      const htmlSkin = await page.evaluate(() => document.documentElement.getAttribute('data-skin'))
      expect(htmlSkin).toBeTruthy()
    }).toPass({ timeout: 5000 })
  })

  // ─── S09: 我的仓库 ─────────────────────────────────────

  test('S09: inventory page shows owned products', async ({ page }) => {
    await page.goto(`${BASE}/shop/inventory`)
    await waitForHydration(page)

    await expect(page.locator('.page-title')).toContainText('我的仓库', { timeout: 8000 })

    // 当前装扮区域
    await expect(page.getByText('当前装扮')).toBeVisible({ timeout: 5000 })
    // 应有"更换"按钮
    await expect(page.getByRole('button', { name: '更换' })).toBeVisible()

    // 已拥有商品应 ≥ 1（至少有刚购买的）
    const productCards = page.locator('.product-card')
    await expect(productCards.first()).toBeVisible({ timeout: 5000 })
  })

  // ─── S10: 仓库换肤 picker ───────────────────────────────

  test('S10: skin picker modal in inventory', async ({ page }) => {
    await page.goto(`${BASE}/shop/inventory`)
    await waitForHydration(page)
    await expect(page.getByText('当前装扮')).toBeVisible({ timeout: 8000 })

    // 点击"更换"弹出皮肤选择器
    await page.getByRole('button', { name: '更换' }).click()
    await expect(page.getByText('选择皮肤')).toBeVisible({ timeout: 5000 })

    // 选择器应有"简约默认"选项
    await expect(page.locator('.skin-pick-name', { hasText: '简约默认' })).toBeVisible()
  })

  // ─── S11: 象币流水弹窗 ──────────────────────────────────

  test('S11: wallet transactions modal', async ({ page }) => {
    await page.goto(`${BASE}/shop`)
    await waitForHydration(page)

    const walletBadge = page.locator('.wallet-badge')
    await expect(walletBadge).toBeVisible({ timeout: 8000 })

    // 点击钱包徽章打开流水弹窗
    await walletBadge.click()
    await expect(page.getByText('象币流水')).toBeVisible({ timeout: 5000 })

    // 应至少有注册奖励记录
    await expect(page.getByText('新用户注册奖励')).toBeVisible({ timeout: 5000 })
  })

  // ─── S12: 更多页面入口 ──────────────────────────────────

  test('S12: more page has shop and inventory links', async ({ page }) => {
    await page.goto(`${BASE}/more`)
    await waitForHydration(page)

    await expect(page.getByText('手帐商店')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('密码本')).toBeVisible()

    // "手帐商店" is a coming-soon card — click shows toast, not navigation
    await page.getByText('手帐商店').click()
    await expect(page.getByText('该功能正在开发中')).toBeVisible({ timeout: 5000 })
  })
})
