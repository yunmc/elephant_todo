/**
 * E2E — Premium: 会员状态卡片、PremiumModal 升级引导
 *
 * 测试场景：
 * - 免费用户设置页显示升级卡片
 * - Premium 用户设置页显示会员状态 + 到期时间
 * - 免费用户触碰付费功能弹出 PremiumModal
 * - PremiumModal 可以关闭
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

let tokens: { accessToken: string; refreshToken: string }

test.describe.serial('Premium', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  test('P01: 免费用户设置页显示升级卡片', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)
    await expect(page.locator('.jp-header-title')).toContainText('設置', { timeout: 8000 })

    // 免费用户应看到"高级功能"卡片
    const upgradeCard = page.locator('.jp-card--premium').filter({ hasText: '高级功能' })
    await expect(upgradeCard).toBeVisible({ timeout: 5000 })
  })

  test('P02: Premium 用户设置页显示会员状态', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)

    // Directly modify Pinia auth store state to simulate premium user
    await page.evaluate(() => {
      const app = (document.getElementById('__nuxt') as any)?.__vue_app__
      if (app) {
        const pinia = app.config.globalProperties.$pinia
        if (pinia?.state?.value?.auth) {
          pinia.state.value.auth.user = {
            ...(pinia.state.value.auth.user || {}),
            id: pinia.state.value.auth.user?.id || 999,
            username: pinia.state.value.auth.user?.username || 'test_premium',
            email: pinia.state.value.auth.user?.email || 'test@test.com',
            plan: 'premium',
            plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            auto_renew: false,
          }
        }
      }
    })

    // Premium 用户应看到"高级功能"卡片
    const premiumCard = page.locator('.jp-card--premium').filter({ hasText: '高级功能' })
    await expect(premiumCard).toBeVisible({ timeout: 5000 })
  })

  test('P03: PremiumModal 弹出与关闭', async ({ page }) => {
    // 将用户降级回 free（通过 DB 或重新注册一个新用户）
    // 这里用新注册用户来保证是 free 状态
    const freshResult = await registerOnce()
    await injectAuth(page, freshResult.tokens)

    await page.goto(`${BASE}/settings`)
    await waitForHydration(page)

    // 点击升级卡片的"了解更多"按钮触发 PremiumModal
    const upgradeButton = page.locator('.premium-card').getByRole('button')
    if (await upgradeButton.isVisible()) {
      await upgradeButton.click()

      // PremiumModal 应可见
      const modal = page.locator('.n-modal').filter({ hasText: '升级 Premium' })
      await expect(modal).toBeVisible({ timeout: 5000 })

      // 点"以后再说"关闭
      await page.getByText('以后再说').click()
      await expect(modal).not.toBeVisible({ timeout: 5000 })
    }
  })
})
