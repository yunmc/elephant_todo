/**
 * E2E — AI Features (AI04–AI08)
 *
 * Tests AI report page and premium gating.
 * AI01-AI03 (AI 记账按钮) removed — feature refactored to voice input inside modal.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

let tokens: { accessToken: string; refreshToken: string }

test.describe('AI Features', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  // ═══════════════════════════════════════════════════════════
  // AI Report Page
  // ═══════════════════════════════════════════════════════════

  test('AI04: AI 报告入口在更多页面', async ({ page }) => {
    await page.goto(`${BASE}/more`)
    await waitForHydration(page);
    await expect(page.locator('.page-title')).toBeVisible({ timeout: 8000 });

    // AI 报告卡片应该可见
    const aiReportCard = page.getByText('AI 报告')
    await expect(aiReportCard).toBeVisible({ timeout: 5000 })
  })

  test('AI05: 点击 AI 报告卡片显示开发中提示', async ({ page }) => {
    await page.goto(`${BASE}/more`)
    await waitForHydration(page);
    await expect(page.locator('.page-title')).toBeVisible({ timeout: 8000 });

    // AI 报告 is a coming-soon card — dispatchEvent triggers Vue event handler
    const card = page.locator('.feature-card.coming-soon').filter({ hasText: 'AI 报告' })
    await expect(card).toBeVisible({ timeout: 5000 })
    await card.dispatchEvent('click')
    await expect(page.locator('.n-message').or(page.getByText('该功能正在开发中')).first()).toBeVisible({ timeout: 5000 })
  })

  test('AI06: AI 报告页面有月度/年度 Tab', async ({ page }) => {
    await page.goto(`${BASE}/ai/report`)
    await waitForHydration(page);
    await expect(page.locator('.page-title')).toBeVisible({ timeout: 8000 });

    const monthlyTab = page.getByText('月度报告')
    const yearlyTab = page.getByText('年度报告')

    await expect(monthlyTab).toBeVisible({ timeout: 5000 })
    await expect(yearlyTab).toBeVisible()
  })

  test('AI07: AI 报告页面有日期选择器和生成按钮', async ({ page }) => {
    await page.goto(`${BASE}/ai/report`)
    await waitForHydration(page);
    await expect(page.locator('.page-title')).toBeVisible({ timeout: 8000 });

    // Date label should show current year/month
    const now = new Date()
    const expectedLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`
    await expect(page.getByText(expectedLabel)).toBeVisible({ timeout: 5000 })

    // Generate button should exist
    const generateBtn = page.getByText('生成报告')
    await expect(generateBtn).toBeVisible()
  })

  test('AI08: 切换到年度报告 Tab', async ({ page }) => {
    await page.goto(`${BASE}/ai/report`)
    await waitForHydration(page);
    await expect(page.locator('.page-title')).toBeVisible({ timeout: 8000 });

    // Click yearly tab
    await page.getByText('年度报告').click()

    // Should show year only
    const now = new Date()
    const yearLabel = `${now.getFullYear()}年`
    // The date label should contain just the year (no month)
    const dateLabel = page.locator('.date-label')
    await expect(dateLabel).toContainText(yearLabel, { timeout: 5000 })
  })
})
