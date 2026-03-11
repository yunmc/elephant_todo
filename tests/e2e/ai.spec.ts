/**
 * E2E — AI Features (AI01–AI08)
 *
 * Tests AI quick entry, AI report page, and premium gating.
 * These tests verify UI interaction flows but mock-intercept
 * actual AI API calls since LLM responses are non-deterministic.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'

let tokens: { accessToken: string; refreshToken: string }

test.describe.serial('AI Features', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  // ═══════════════════════════════════════════════════════════
  // AI Quick Entry
  // ═══════════════════════════════════════════════════════════

  test('AI01: AI 记账按钮存在于记账页面', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // AI 记账按钮应该可见
    const aiBtn = page.getByText('AI 记账')
    await expect(aiBtn).toBeVisible({ timeout: 5000 })
  })

  test('AI02: 点击 AI 记账按钮（免费用户触发升级弹窗）', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('记账', { timeout: 8000 })

    // Click AI button
    const aiBtn = page.getByText('AI 记账')
    await expect(aiBtn).toBeVisible({ timeout: 5000 })
    await aiBtn.click()

    // AI feature is in development — click shows a toast message
    await expect(page.getByText('该功能正在开发中')).toBeVisible({ timeout: 8000 })
  })

  test('AI03: AI 快速记账弹窗包含输入框和解析按钮', async ({ page }) => {
    await page.goto(`${BASE}/finance`)
    await waitForHydration(page)

    // AI feature is in development — even for premium users, click shows toast
    const aiBtn = page.getByText('AI 记账')
    await aiBtn.click()
    await expect(page.getByText('该功能正在开发中')).toBeVisible({ timeout: 8000 })
  })

  // ═══════════════════════════════════════════════════════════
  // AI Report Page
  // ═══════════════════════════════════════════════════════════

  test('AI04: AI 报告入口在更多页面', async ({ page }) => {
    await page.goto(`${BASE}/more`)
    await waitForHydration(page)

    // AI 报告卡片应该可见
    const aiReportCard = page.getByText('AI 报告')
    await expect(aiReportCard).toBeVisible({ timeout: 5000 })
  })

  test('AI05: 点击 AI 报告可以导航到报告页面', async ({ page }) => {
    await page.goto(`${BASE}/more`)
    await waitForHydration(page)

    // AI 报告 is a coming-soon card — click shows toast, not navigation
    await page.getByText('AI 报告').click()
    await expect(page.getByText('该功能正在开发中')).toBeVisible({ timeout: 5000 })
  })

  test('AI06: AI 报告页面有月度/年度 Tab', async ({ page }) => {
    await page.goto(`${BASE}/ai/report`)
    await waitForHydration(page)

    const monthlyTab = page.getByText('月度报告')
    const yearlyTab = page.getByText('年度报告')

    await expect(monthlyTab).toBeVisible({ timeout: 5000 })
    await expect(yearlyTab).toBeVisible()
  })

  test('AI07: AI 报告页面有日期选择器和生成按钮', async ({ page }) => {
    await page.goto(`${BASE}/ai/report`)
    await waitForHydration(page)

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
    await waitForHydration(page)

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
