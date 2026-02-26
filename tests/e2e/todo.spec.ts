/**
 * E2E — Todo CRUD + Subtasks + Filters + Priority/Category/Tags/DueDate (T01–T12)
 *
 * Serial tests sharing the same user.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const TITLE = `E2E Todo ${Date.now()}`
const CATEGORY_NAME = `E2E Cat ${Date.now()}`

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

  test('T06: set priority in detail view', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    // Clear search first
    await page.getByPlaceholder('搜索待办...').fill('')
    await page.waitForTimeout(500)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    // Navigate to todo detail
    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByPlaceholder('待办标题')).toBeVisible({ timeout: 5000 })

    // Find the priority select (in .info-row next to "优先级" label)
    const priorityRow = page.locator('.info-row').filter({ hasText: '优先级' })
    await expect(priorityRow).toBeVisible()

    // Click the select trigger to open dropdown
    await priorityRow.locator('.n-base-selection').click()
    await page.waitForTimeout(500)

    // Select "高" priority
    await page.getByText('高', { exact: true }).click()
    await page.waitForTimeout(500)

    // Save
    await page.locator('.action-btn.save').click()
    await page.waitForTimeout(1000)

    // Go back and verify priority tag shows on list
    await page.locator('.back-btn').click()
    await page.waitForTimeout(1000)

    // The todo item should show a "高" priority tag
    const todoItem = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` })
    await expect(todoItem.locator('.priority-high')).toBeVisible({ timeout: 5000 })
  })

  test('T08: inline create category in detail view', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await page.waitForTimeout(500)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    // Navigate to todo detail
    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByPlaceholder('待办标题')).toBeVisible({ timeout: 5000 })

    // Find the category row and click the select to open dropdown
    const categoryRow = page.locator('.info-row').filter({ hasText: '分类' })
    await expect(categoryRow).toBeVisible()
    await categoryRow.locator('.n-base-selection').click()
    await page.waitForTimeout(500)

    // The #action slot input is now visible in the dropdown
    const categoryName = `Cat${Date.now()}`
    await page.getByPlaceholder('新分类名称').fill(categoryName)
    await page.waitForTimeout(300)

    // Click the "添加" button in the select dropdown action slot
    // NaiveUI renders the dropdown in a teleported container
    await page.locator('.n-base-select-menu__action').locator('button:has-text("添加")').click()
    await page.waitForTimeout(1000)

    // Close dropdown by clicking elsewhere
    await page.locator('.page-container').click({ position: { x: 10, y: 10 } })
    await page.waitForTimeout(500)

    // Save
    await page.locator('.action-btn.save').click()
    await page.waitForTimeout(1000)

    // Go back and verify category shows on list
    await page.locator('.back-btn').click()
    await page.waitForTimeout(1000)

    const todoItem = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` })
    await expect(todoItem.locator('.category')).toBeVisible({ timeout: 5000 })
  })

  test('T09: filter by priority', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await page.waitForTimeout(500)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    // Open filter panel
    await page.getByRole('button', { name: /筛选/ }).click()
    await page.waitForTimeout(500)

    // Click the first n-select (priority filter) in the grid
    const prioritySelect = page.locator('.n-select').first()
    await prioritySelect.click()
    await page.waitForTimeout(300)

    // Select "高" priority from dropdown using NaiveUI option class
    await page.locator('.n-base-select-option__content').filter({ hasText: '高' }).click()
    await page.waitForTimeout(1000)

    // Our todo with high priority should be visible
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })

    // Now filter by "低" priority — our todo should not be visible
    await prioritySelect.click()
    await page.waitForTimeout(300)
    await page.locator('.n-base-select-option__content').filter({ hasText: '低' }).click()
    await page.waitForTimeout(1000)
    await expect(page.getByText(`${TITLE} Updated`)).not.toBeVisible({ timeout: 3000 })

    // Reset filters
    await page.getByText('重置全部筛选').click()
    await page.waitForTimeout(1000)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })
  })

  test('T10: set due date in detail view', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await page.waitForTimeout(500)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    // Navigate to todo detail
    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByPlaceholder('待办标题')).toBeVisible({ timeout: 5000 })

    // Find the due date row and click the date picker
    const dueDateRow = page.locator('.info-row').filter({ hasText: '截止日期' })
    await expect(dueDateRow).toBeVisible()

    // Click the date picker input to open
    await dueDateRow.locator('.n-date-picker').click()
    await page.waitForTimeout(500)

    // Set due date to tomorrow by typing directly
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    const dateInput = dueDateRow.locator('.n-date-picker input')
    await dateInput.fill(dateStr)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)

    // Save
    await page.locator('.action-btn.save').click()
    await page.waitForTimeout(1000)

    // Go back and verify date tag shows on list
    await page.locator('.back-btn').click()
    await page.waitForTimeout(1000)

    const todoItem = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` })
    await expect(todoItem.locator('.meta-tag').nth(1)).toBeVisible({ timeout: 5000 })
  })

  test('T11: add tags in detail view', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await page.waitForTimeout(500)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    // Navigate to todo detail
    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByPlaceholder('待办标题')).toBeVisible({ timeout: 5000 })

    // Find tag row and click select to open dropdown
    const tagRow = page.locator('.info-row').filter({ hasText: '标签' })
    await expect(tagRow).toBeVisible()
    await tagRow.locator('.n-base-selection').click()
    await page.waitForTimeout(500)

    // Create new tag inline via action slot
    const tagName = `Tag${Date.now()}`
    await page.getByPlaceholder('新标签名称').fill(tagName)
    await page.waitForTimeout(300)
    await page.locator('.n-base-select-menu__action').locator('button:has-text("添加")').click()
    await page.waitForTimeout(1000)

    // Close dropdown
    await page.locator('.page-container').click({ position: { x: 10, y: 10 } })
    await page.waitForTimeout(500)

    // Save
    await page.locator('.action-btn.save').click()
    await page.waitForTimeout(1000)

    // Go back and verify tag shows on list
    await page.locator('.back-btn').click()
    await page.waitForTimeout(1000)

    const todoItem = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` })
    await expect(todoItem.locator('.tag-chip')).toBeVisible({ timeout: 5000 })
  })

  test('T12: filter by category', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await page.waitForTimeout(500)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    // Open filter panel
    await page.getByRole('button', { name: /筛选/ }).click()
    await page.waitForTimeout(500)

    // Click the third n-select (category filter) in the grid
    // Order: priority, date, category, tag
    const categorySelect = page.locator('.n-select').nth(2)
    await categorySelect.click()
    await page.waitForTimeout(300)

    // Select the first available category from dropdown
    const firstOption = page.locator('.n-base-select-option__content').first()
    const optionText = await firstOption.textContent()
    await firstOption.click()
    await page.waitForTimeout(1000)

    // Our todo has a category (from T08), should be visible
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })

    // Reset filters
    await page.getByText('重置全部筛选').click()
    await page.waitForTimeout(1000)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })
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
