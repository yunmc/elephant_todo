/**
 * E2E — Todo CRUD + Subtasks + Filters + Priority/Category/Tags/DueDate (T01–T19)
 *
 * Serial tests sharing the same user.
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'
import { waitForSelectOpen, waitForSelectClose } from './fixtures/naive-helpers'

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

    // T13: verify empty state for fresh user (before first todo is created)
    const emptyVisible = await page.getByText('暂无待办事项').isVisible().catch(() => false)

    // Open quick-add modal via ＋ button
    await page.keyboard.press('Escape')
    await page.evaluate(() => (document.querySelector('.nav-add') as HTMLElement)?.click())
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 15000 })

    // Type content and click "新建待办" — verify API succeeds
    await page.getByPlaceholder('输入内容...').fill(TITLE)
    const [createResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/todos') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '新建待办' }).click(),
    ])
    expect(createResp.ok(), `Todo create API failed: ${createResp.status()}`).toBe(true)

    await expect(page).toHaveURL(/\/$/, { timeout: 8000 })
    await expect(page.getByText(TITLE)).toBeVisible({ timeout: 5000 })
  })

  test('T02: edit todo title & description', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await expect(page.getByText(TITLE)).toBeVisible({ timeout: 8000 })

    await page.getByText(TITLE).click()
    await expect(page.getByPlaceholder('待办标题')).toBeVisible({ timeout: 5000 })

    const titleInput = page.getByPlaceholder('待办标题')
    await titleInput.fill(`${TITLE} Updated`)
    await page.getByPlaceholder('添加描述...').fill('E2E test description')

    // Save — wait for API response instead of timeout
    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().match(/\/api\/todos\/\d+/) !== null && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.locator('.action-btn.save').click(),
    ])
    expect(saveResp.ok()).toBe(true)

    await page.locator('.back-btn').click()
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })
  })

  test('T05: subtask CRUD', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByText('子任务')).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder('添加子任务...').fill('E2E subtask')
    await page.locator('.add-subtask-btn').click()
    await expect(page.getByText('E2E subtask')).toBeVisible({ timeout: 3000 })

    const subtaskCheck = page.locator('.subtask-check .check-circle').first()
    await subtaskCheck.click()
    await expect(subtaskCheck).toHaveClass(/checked/, { timeout: 3000 })

    await page.locator('.subtask-del').first().click()
    await expect(page.getByText('E2E subtask')).not.toBeVisible({ timeout: 3000 })
  })

  test('T03: toggle completion + status tabs', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    const firstCheck = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` }).locator('.check-circle')
    await firstCheck.click()

    await page.getByText('已完成').click()
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })

    await page.getByText('进行中').click()
    await expect(page.getByText(`${TITLE} Updated`)).not.toBeVisible({ timeout: 5000 })

    await page.getByText('全部').click()
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })

    const check2 = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` }).locator('.check-circle')
    await check2.click()
    await expect(check2).not.toHaveClass(/checked/, { timeout: 3000 })
  })

  test('T07: search todos', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    await page.getByPlaceholder('搜索待办...').fill('E2E Todo')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder('搜索待办...').fill('ZZZZNOTEXIST')
    await expect(page.getByText(`${TITLE} Updated`)).not.toBeVisible({ timeout: 3000 })
  })

  test('T06: set priority in detail view', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByPlaceholder('待办标题')).toBeVisible({ timeout: 5000 })

    const priorityRow = page.locator('.info-row').filter({ hasText: '优先级' })
    await expect(priorityRow).toBeVisible()

    await priorityRow.locator('.n-base-selection').click()
    await waitForSelectOpen(page)
    await page.getByText('高', { exact: true }).click()
    await waitForSelectClose(page)

    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().match(/\/api\/todos\/\d+/) !== null && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.locator('.action-btn.save').click(),
    ])
    expect(saveResp.ok()).toBe(true)

    await page.locator('.back-btn').click()
    const todoItem = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` })
    await expect(todoItem.locator('.priority-high')).toBeVisible({ timeout: 5000 })
  })

  test('T08: inline create category in detail view', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByPlaceholder('待办标题')).toBeVisible({ timeout: 5000 })

    const categoryRow = page.locator('.info-row').filter({ hasText: '分类' })
    await expect(categoryRow).toBeVisible()
    await categoryRow.locator('.n-base-selection').click()
    await waitForSelectOpen(page)

    const categoryName = `Cat${Date.now()}`
    await page.getByPlaceholder('新分类名称').fill(categoryName)

    const [catResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/categories') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.locator('.n-base-select-menu__action').locator('button:has-text("添加")').click(),
    ])
    expect(catResp.ok()).toBe(true)

    await page.locator('.page-container').click({ position: { x: 10, y: 10 } })
    await waitForSelectClose(page)

    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().match(/\/api\/todos\/\d+/) !== null && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.locator('.action-btn.save').click(),
    ])
    expect(saveResp.ok()).toBe(true)

    await page.locator('.back-btn').click()
    const todoItem = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` })
    await expect(todoItem.locator('.category')).toBeVisible({ timeout: 5000 })
  })

  test('T09: filter by priority', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /筛选/ }).click()
    await expect(page.locator('.n-select').first()).toBeVisible({ timeout: 3000 })

    const prioritySelect = page.locator('.n-select').first()
    await prioritySelect.click()
    await waitForSelectOpen(page)
    await page.locator('.n-base-select-option__content').filter({ hasText: '高' }).click()
    await waitForSelectClose(page)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })

    await prioritySelect.click()
    await waitForSelectOpen(page)
    await page.locator('.n-base-select-option__content').filter({ hasText: '低' }).click()
    await waitForSelectClose(page)
    await expect(page.getByText(`${TITLE} Updated`)).not.toBeVisible({ timeout: 3000 })

    await page.getByText('重置全部筛选').click()
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })
  })

  test('T10: set due date in detail view', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByPlaceholder('待办标题')).toBeVisible({ timeout: 5000 })

    const dueDateRow = page.locator('.info-row').filter({ hasText: '截止日期' })
    await expect(dueDateRow).toBeVisible()
    await dueDateRow.locator('.n-date-picker').click()

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    const dateInput = dueDateRow.locator('.n-date-picker input')
    await dateInput.fill(dateStr)
    await page.keyboard.press('Enter')

    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().match(/\/api\/todos\/\d+/) !== null && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.locator('.action-btn.save').click(),
    ])
    expect(saveResp.ok(), `Todo update API failed: ${saveResp.status()}`).toBe(true)
    const saveBody = await saveResp.json()
    expect(saveBody.data?.due_date || saveBody.due_date).toBeTruthy()

    await page.locator('.back-btn').click()
    const todoItem = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` })
    await expect(todoItem.locator('.meta-tag').nth(1)).toBeVisible({ timeout: 5000 })
  })

  test('T11: add tags in detail view', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByPlaceholder('待办标题')).toBeVisible({ timeout: 5000 })

    const tagRow = page.locator('.info-row').filter({ hasText: '标签' })
    await expect(tagRow).toBeVisible()
    await tagRow.locator('.n-base-selection').click()
    await waitForSelectOpen(page)

    const tagName = `Tag${Date.now()}`
    await page.getByPlaceholder('新标签名称').fill(tagName)
    const [tagResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/tags') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.locator('.n-base-select-menu__action').locator('button:has-text("添加")').click(),
    ])
    expect(tagResp.ok()).toBe(true)

    await page.locator('.page-container').click({ position: { x: 10, y: 10 } })
    await waitForSelectClose(page)

    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().match(/\/api\/todos\/\d+/) !== null && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.locator('.action-btn.save').click(),
    ])
    expect(saveResp.ok()).toBe(true)

    await page.locator('.back-btn').click()
    const todoItem = page.locator('.todo-item').filter({ hasText: `${TITLE} Updated` })
    await expect(todoItem.locator('.tag-chip')).toBeVisible({ timeout: 5000 })
  })

  test('T12: filter by category', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /筛选/ }).click()
    await expect(page.locator('.n-select').first()).toBeVisible({ timeout: 3000 })

    const categorySelect = page.locator('.n-select').nth(2)
    await categorySelect.click()
    await waitForSelectOpen(page)

    const firstOption = page.locator('.n-base-select-option__content').first()
    const optionText = await firstOption.textContent()
    await firstOption.click()
    await waitForSelectClose(page)

    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })

    await page.getByText('重置全部筛选').click()
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })
  })

  test('T14: inline delete todo from list via popconfirm', async ({ page }) => {
    const tmpTitle = `E2E InlineDel ${Date.now()}`
    await page.goto(BASE)
    await waitForHydration(page)
    await expect(page.locator('.page-title')).toContainText('待办事项', { timeout: 8000 })

    await page.keyboard.press('Escape')
    await page.evaluate(() => (document.querySelector('.nav-add') as HTMLElement)?.click())
    await expect(page.getByPlaceholder('输入内容...')).toBeVisible({ timeout: 15000 })
    await page.getByPlaceholder('输入内容...').fill(tmpTitle)
    await page.getByRole('button', { name: '新建待办' }).click()
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 })
    await expect(page.getByText(tmpTitle)).toBeVisible({ timeout: 5000 })

    const todoItem = page.locator('.todo-item').filter({ hasText: tmpTitle })
    await todoItem.getByRole('button', { name: '删除' }).click()
    await page.getByRole('button', { name: '删除' }).last().click()
    await expect(page.getByText(tmpTitle)).not.toBeVisible({ timeout: 5000 })
  })

  test('T15: due date filter UI — select and reset', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    const filterBtn = page.getByRole('button', { name: /筛选/ })
    await filterBtn.click()
    await expect(page.locator('.n-select').first()).toBeVisible({ timeout: 3000 })

    await expect(page.getByText('重置全部筛选')).not.toBeVisible({ timeout: 2000 })

    const dateSelect = page.locator('.n-select').nth(1)
    await expect(dateSelect).toBeVisible({ timeout: 3000 })
    await dateSelect.click()
    await waitForSelectOpen(page)

    const overdueOption = page.locator('.n-base-select-option').filter({ hasText: '已过期' })
    await expect(overdueOption).toBeVisible({ timeout: 3000 })
    await overdueOption.click()
    await waitForSelectClose(page)

    await expect(page.getByText('重置全部筛选')).toBeVisible({ timeout: 5000 })
    await expect(dateSelect).toContainText('已过期', { timeout: 3000 })

    await page.getByText('重置全部筛选').click()
    await expect(page.getByText('重置全部筛选')).not.toBeVisible({ timeout: 3000 })
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })
  })

  test('T16: filter by tag', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /筛选/ }).click()
    await expect(page.locator('.n-select').first()).toBeVisible({ timeout: 3000 })

    const tagSelect = page.locator('.n-select').nth(3)
    await tagSelect.click()
    await waitForSelectOpen(page)
    const firstOption = page.locator('.n-base-select-option__content').first()
    await firstOption.click()
    await waitForSelectClose(page)

    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })

    await page.getByText('重置全部筛选').click()
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 5000 })
  })

  test('T17: status toggle from detail page', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByPlaceholder('待办标题')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.status-pill')).toContainText('进行中', { timeout: 3000 })

    await page.locator('.status-pill').click()
    await expect(page.locator('.status-pill')).toContainText('已完成', { timeout: 5000 })

    await page.locator('.status-pill').click()
    await expect(page.locator('.status-pill')).toContainText('进行中', { timeout: 5000 })

    await page.locator('.back-btn').click()
  })

  test('T18: subtask inline edit', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByText('子任务')).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder('添加子任务...').fill('Editable subtask')
    await page.locator('.add-subtask-btn').click()
    await expect(page.getByText('Editable subtask')).toBeVisible({ timeout: 3000 })

    await page.locator('.subtask-title').filter({ hasText: 'Editable subtask' }).click()
    const editInput = page.locator('.subtask-edit-input')
    await expect(editInput).toBeVisible({ timeout: 3000 })

    await editInput.fill('Edited subtask title')
    await editInput.press('Enter')
    await expect(page.getByText('Edited subtask title')).toBeVisible({ timeout: 5000 })

    await page.locator('.subtask-del').first().click()
    await expect(page.getByText('Edited subtask title')).not.toBeVisible({ timeout: 3000 })

    await page.locator('.back-btn').click()
  })

  test('T19: data persistence after reload', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    await page.reload()
    await waitForHydration(page)
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })
  })

  test('T04: delete todo', async ({ page }) => {
    await page.goto(BASE)
    await waitForHydration(page)
    await page.getByPlaceholder('搜索待办...').fill('')
    await expect(page.getByText(`${TITLE} Updated`)).toBeVisible({ timeout: 8000 })

    await page.getByText(`${TITLE} Updated`).click()
    await expect(page.getByText('删除这个待办')).toBeVisible({ timeout: 5000 })
    await page.getByText('删除这个待办').click()

    await page.getByRole('button', { name: '删除', exact: true }).click()
    await expect(page).toHaveURL(/\/$/, { timeout: 8000 })
    await expect(page.getByText(`${TITLE} Updated`)).not.toBeVisible({ timeout: 5000 })
  })
})
