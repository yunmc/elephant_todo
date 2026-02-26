/**
 * E2E — Todo CRUD + Subtasks + Filters (T01–T07)
 *
 * Serial tests sharing the same user.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const TITLE = `E2E Todo ${Date.now()}`

let tokens: { accessToken: string; refreshToken: string }

test.describe.serial('Todo Flow', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  test('T01: create todo via quick-add', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('待办事项', { timeout: 8000 })

    // Open quick-add modal via ＋ button (dispatchEvent bypasses DevTools overlay)
    await page.locator('.nav-add').dispatchEvent('click')
    // Wait for modal content to appear
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 5000 })

    // Type content and click "新建待办"
    await page.getByPlaceholder('输入内容...').fill(TITLE)
    await page.getByRole('button', { name: '新建待办' }).click()

    // Wait for navigation back to home + todo to appear
    await expect(page).toHaveURL(/\/$/, { timeout: 8000 })
    await expect(page.getByText(TITLE)).toBeVisible({ timeout: 5000 })
  })

  test('T02: edit todo title & description', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await expect(page.getByText(TITLE)).toBeVisible({ timeout: 8000 })

    // Click into todo detail
    await page.getByText(TITLE).click()
    await expect(page.getByPlaceholder('待办标题')).toBeVisible({ timeout: 5000 })

    // Edit title
    const titleInput = page.getByPlaceholder('待办标题')
    await titleInput.fill(`${TITLE} Updated`)

    // Edit description
    await page.getByPlaceholder('添加描述...').fill('E2E test description')

    // Save
    await page.locator('.action-btn.save').click()
    await page.waitForTimeout(1000)

    // Go back and verify
    await page.locator('.back-btn').click()
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })
  })

  test('T05: subtask CRUD', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByText('子任务')).toBeVisible({ timeout: 5000 })

    // Add subtask
    await page.getByPlaceholder('添加子任务...').fill('E2E subtask')
    await page.locator('.add-subtask-btn').click()
    await expect(page.getByText('E2E subtask')).toBeVisible({ timeout: 3000 })

    // Toggle subtask complete
    const subtaskCheck = page.locator('.subtask-check .check-circle').first()
    await subtaskCheck.click()
    await page.waitForTimeout(500)
    await expect(subtaskCheck).toHaveClass(/checked/)

    // Delete subtask
    await page.locator('.subtask-del').first().click()
    await page.waitForTimeout(500)
    await expect(page.getByText('E2E subtask')).not.toBeVisible({ timeout: 3000 })
  })

  test('T03: toggle completion + status tabs', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    // Toggle todo complete via check circle
    const firstCheck = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` }).locator('.check-circle')
    await firstCheck.click()
    await page.waitForTimeout(1000)

    // Switch to "已完成" tab
    await page.getByText('已完成').click()
    await page.waitForTimeout(1000)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })

    // Switch to "进行中" tab — should NOT show completed todo
    await page.getByText('进行中').click()
    await page.waitForTimeout(1000)

    // Switch to "全部" tab — should show it
    await page.getByText('全部').click()
    await page.waitForTimeout(1000)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })

    // Restore to pending for delete test
    const check2 = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` }).locator('.check-circle')
    await check2.click()
    await page.waitForTimeout(500)
  })

  test('T07: search todos', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    // Search
    await page.getByPlaceholder('搜索待办...').fill('E2E Todo')
    await page.waitForTimeout(1000)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible()

    // Search non-existent
    await page.getByPlaceholder('搜索待办...').fill('ZZZZNOTEXIST')
    await page.waitForTimeout(1000)
    await expect(page.getByText(`${TITLE} Updated`)).not.toBeVisible({ timeout: 3000 })
  })

  test('T04: delete todo', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    // Clear search first
    await page.getByPlaceholder('搜索待办...').fill('')
    await page.waitForTimeout(500)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    // Click into detail and delete
    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByText('删除这个待办')).toBeVisible({ timeout: 5000 })
    await page.getByText('删除这个待办').click()

    // Confirm delete dialog
    await page.getByRole('button', { name: '删除', exact: true }).click()
    await expect(page).toHaveURL(/\/$/, { timeout: 8000 })
    await expect(page.getByText(`${TITLE} Updated`)).not.toBeVisible({ timeout: 5000 })
  })
})
