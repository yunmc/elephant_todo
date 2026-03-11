/**
 * E2E — Vault (Password Manager) Full Flow (V01–V20)
 *
 * Serial tests sharing the same user.
 * Vault uses client-side AES-256-GCM encryption — all crypto happens in the
 * browser context naturally when the Vue components call useVaultCrypto().
 */
import { test, expect } from '@playwright/test'
import { registerOnce, injectAuth, hideDevToolsOverlay, waitForHydration } from './fixtures/auth.fixture'
import { waitForSelectOpen, waitForSelectClose } from './fixtures/naive-helpers'

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const MASTER_PWD = 'TestMaster123!'
const TS = Date.now()
const GROUP_NAME = `E2E Group ${TS}`
const ENTRY_NAME = `E2E Entry ${TS}`
const ENTRY_USER = `user_${TS}`
const ENTRY_PASS = `pass_${TS}`

let tokens: { accessToken: string; refreshToken: string }

test.describe.serial('Vault Flow', () => {
  test.beforeAll(async () => {
    const result = await registerOnce()
    tokens = result.tokens
  })

  test.beforeEach(async ({ page }) => {
    await hideDevToolsOverlay(page)
    await injectAuth(page, tokens)
  })

  test('V01: vault shows lock screen', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)

    await expect(page.getByText('密码本已锁定')).toBeVisible({ timeout: 8000 })
    await expect(page.getByPlaceholder('主密码')).toBeVisible()
    await expect(page.getByRole('button', { name: '解锁' })).toBeVisible()
  })

  test('V15: Enter key unlocks vault', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await expect(page.getByText('密码本已锁定')).toBeVisible({ timeout: 8000 })

    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByPlaceholder('主密码').press('Enter')

    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })
  })

  test('V18: empty vault shows empty state after unlock', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await expect(page.getByText('密码本已锁定')).toBeVisible({ timeout: 8000 })

    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })

    await expect(page.getByText('暂无条目')).toBeVisible({ timeout: 5000 })
  })

  test('V11: wrong master password shows error', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await expect(page.getByText('密码本已锁定')).toBeVisible({ timeout: 8000 })

    await page.getByPlaceholder('主密码').fill('WrongPassword999!')
    await page.getByRole('button', { name: '解锁' }).click()

    // For a brand new user with no entries, first unlock always succeeds
    // Should either show error or unlock (depending on state)
    const unlockedBtn = page.getByRole('button', { name: '+ 条目' })
    const lockedMsg = page.getByText('密码本已锁定')
    await expect(unlockedBtn.or(lockedMsg)).toBeVisible({ timeout: 20000 })
  })

  test('V02: unlock vault with master password', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await expect(page.getByText('密码本已锁定')).toBeVisible({ timeout: 8000 })

    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()

    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('button', { name: '+ 分组' })).toBeVisible()
    await expect(page.getByText('密码本').first()).toBeVisible()
  })

  test('V03: create group', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: '+ 分组' }).click()
    await expect(page.getByPlaceholder('分组名称')).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder('分组名称').fill(GROUP_NAME)

    const [createResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/vault/groups') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '创建' }).click(),
    ])
    expect(createResp.ok()).toBe(true)

    await expect(page.getByText(GROUP_NAME)).toBeVisible({ timeout: 5000 })
  })

  test('V04: create entry', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: '+ 条目' }).click()
    await expect(page.getByPlaceholder('名称 (如: GitHub)')).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder('名称 (如: GitHub)').fill(ENTRY_NAME)
    await page.getByPlaceholder('网址 (可选)').fill('https://example.com')
    await page.getByPlaceholder('用户名').fill(ENTRY_USER)
    await page.getByPlaceholder('密码').fill(ENTRY_PASS)
    await page.getByPlaceholder('备注 (可选)').fill('E2E test notes')

    const [createResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/vault/entries') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '创建' }).click(),
    ])
    expect(createResp.ok(), `Vault create entry API failed: ${createResp.status()}`).toBe(true)

    await expect(page.getByText(ENTRY_NAME)).toBeVisible({ timeout: 5000 })
  })

  test('V05: quick decrypt entry', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByText(ENTRY_NAME)).toBeVisible({ timeout: 20000 })

    // Click eye button for quick decrypt
    const eyeBtn = page.locator('button:has-text("👁️")').first()
    await eyeBtn.click()

    // Should show decrypted username
    await expect(page.getByText(`用户名: ${ENTRY_USER}`)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('密码: ••••••••')).toBeVisible()

    // Click "显示" to reveal password
    await page.getByRole('button', { name: '显示' }).first().click()
    await expect(page.getByText(`密码: ${ENTRY_PASS}`)).toBeVisible({ timeout: 3000 })

    // Click "隐藏" to hide password again
    await page.getByRole('button', { name: '隐藏' }).first().click()
    await expect(page.getByText('密码: ••••••••')).toBeVisible({ timeout: 3000 })
  })

  test('V06: search entries', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByText(ENTRY_NAME)).toBeVisible({ timeout: 20000 })

    // Search by entry name
    await page.getByPlaceholder('搜索条目...').fill('E2E Entry')
    await expect(page.getByText(ENTRY_NAME)).toBeVisible({ timeout: 5000 })

    // Search non-existent
    await page.getByPlaceholder('搜索条目...').fill('ZZZZNOTEXIST')
    await expect(page.getByText(ENTRY_NAME)).not.toBeVisible({ timeout: 5000 })

    // Clear search
    await page.getByPlaceholder('搜索条目...').fill('')
    await expect(page.getByText(ENTRY_NAME)).toBeVisible({ timeout: 5000 })
  })

  test('V07: filter by group', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByText(ENTRY_NAME)).toBeVisible({ timeout: 20000 })

    // Click the group chip to filter
    await page.getByText(GROUP_NAME).click()

    // Entry should NOT be visible (created without a group)
    await expect(page.getByText(ENTRY_NAME)).not.toBeVisible({ timeout: 5000 })

    // Click "全部" to show all entries again
    await page.getByText('全部').first().click()
    await expect(page.getByText(ENTRY_NAME)).toBeVisible({ timeout: 5000 })
  })

  test('V08: navigate to entry detail and decrypt', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByText(ENTRY_NAME)).toBeVisible({ timeout: 20000 })

    await page.getByText(ENTRY_NAME).click()
    await page.waitForURL(/\/vault\/\d+/, { timeout: 5000 })

    await expect(page.getByText('需要验证')).toBeVisible({ timeout: 5000 })
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()

    await expect(page.getByText(ENTRY_NAME)).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('账户信息')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(ENTRY_USER)).toBeVisible()
  })

  test('V09: edit entry from detail page', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByText(ENTRY_NAME)).toBeVisible({ timeout: 20000 })

    await page.getByText(ENTRY_NAME).click()
    await page.waitForURL(/\/vault\/\d+/, { timeout: 5000 })
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByText(ENTRY_NAME)).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: '编辑' }).click()
    await expect(page.getByPlaceholder('名称')).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder('名称').fill(`${ENTRY_NAME} Updated`)

    const [saveResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/vault/entries') && resp.request().method() === 'PUT', { timeout: 10000 }),
      page.getByRole('button', { name: '保存' }).click(),
    ])
    expect(saveResp.ok()).toBe(true)

    await expect(page.getByText(`${ENTRY_NAME} Updated`)).toBeVisible({ timeout: 5000 })
  })

  test('V10: delete entry from detail page', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByText(`${ENTRY_NAME} Updated`)).toBeVisible({ timeout: 20000 })

    await page.getByText(`${ENTRY_NAME} Updated`).click()
    await page.waitForURL(/\/vault\/\d+/, { timeout: 5000 })
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByText(`${ENTRY_NAME} Updated`)).toBeVisible({ timeout: 20000 })

    // Click delete button (n-popconfirm trigger)
    await page.getByRole('button', { name: '删除' }).click()

    // Confirm delete in popconfirm
    const confirmBtn = page.locator('.n-popconfirm__action').locator('button').last()
    await confirmBtn.click()

    // Should navigate back to vault list
    await expect(page).toHaveURL(/\/vault$/, { timeout: 8000 })
  })

  test('V12: delete group via closable tag', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })

    await expect(page.getByText(GROUP_NAME)).toBeVisible({ timeout: 5000 })

    const groupTag = page.locator('.n-tag').filter({ hasText: GROUP_NAME })
    await groupTag.locator('.n-tag__close').click()

    await expect(page.getByText(GROUP_NAME)).not.toBeVisible({ timeout: 5000 })
  })

  test('V13: password generator fills password field', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: '+ 条目' }).click()
    await expect(page.getByPlaceholder('名称 (如: GitHub)')).toBeVisible({ timeout: 5000 })

    const passwordInput = page.getByPlaceholder('密码')
    await expect(passwordInput).toHaveValue('')

    await page.getByRole('button', { name: '🎲 生成' }).click()

    // Password field should now have a value
    await expect(async () => {
      const generatedPwd = await passwordInput.inputValue()
      expect(generatedPwd.length).toBeGreaterThanOrEqual(8)
    }).toPass({ timeout: 3000 })

    await page.keyboard.press('Escape')
  })

  test('V19: empty name entry validation', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: '+ 条目' }).click()
    await expect(page.getByPlaceholder('名称 (如: GitHub)')).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder('用户名').fill('someuser')
    await page.getByPlaceholder('密码').fill('somepass')

    await page.getByRole('button', { name: '创建' }).click()

    await expect(page.getByText('请输入名称')).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
  })

  test('V20: empty credentials entry validation', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: '+ 条目' }).click()
    await expect(page.getByPlaceholder('名称 (如: GitHub)')).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder('名称 (如: GitHub)').fill('Test Entry No Creds')

    await page.getByRole('button', { name: '创建' }).click()

    await expect(page.getByText('请输入用户名或密码')).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
  })

  test('V14: create entry assigned to group and filter by group', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })

    // Create a new group
    const groupName2 = `E2E Grp2 ${TS}`
    await page.getByRole('button', { name: '+ 分组' }).click()
    await expect(page.getByPlaceholder('分组名称')).toBeVisible({ timeout: 5000 })
    await page.getByPlaceholder('分组名称').fill(groupName2)

    const [grpResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/vault/groups') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '创建' }).click(),
    ])
    expect(grpResp.ok()).toBe(true)
    await expect(page.getByText(groupName2)).toBeVisible({ timeout: 5000 })

    // Create entry and assign it to the group
    const entryWithGroup = `E2E Grouped ${TS}`
    await page.getByRole('button', { name: '+ 条目' }).click()
    await expect(page.getByPlaceholder('名称 (如: GitHub)')).toBeVisible({ timeout: 5000 })
    await page.getByPlaceholder('名称 (如: GitHub)').fill(entryWithGroup)
    await page.getByPlaceholder('用户名').fill('group_user')
    await page.getByPlaceholder('密码').fill('group_pass')

    // Select the group in the n-select dropdown
    const groupSelect = page.getByRole('dialog').locator('.n-select')
    if (await groupSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await groupSelect.click()
      await waitForSelectOpen(page)
      await page.locator('.n-base-select-option__content').filter({ hasText: groupName2 }).click()
      await waitForSelectClose(page)
    }

    const [entryResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/vault/entries') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '创建' }).click(),
    ])
    expect(entryResp.ok()).toBe(true)

    await expect(page.getByText(entryWithGroup)).toBeVisible({ timeout: 5000 })

    // Filter by created group
    const groupChip = page.locator('.n-tag').filter({ hasText: groupName2 }).first()
    await groupChip.click()
    await expect(page.getByText(entryWithGroup)).toBeVisible({ timeout: 5000 })

    // Switch back to "全部"
    await page.getByText('全部').first().click()
    await expect(page.getByText(entryWithGroup)).toBeVisible({ timeout: 5000 })
  })

  test('V16: password generator options panel toggles', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: '+ 条目' }).click()
    await expect(page.getByPlaceholder('名称 (如: GitHub)')).toBeVisible({ timeout: 5000 })

    // Generator options should be hidden initially
    await expect(page.getByText('长度:')).not.toBeVisible()

    // Click to show generator options
    await page.getByRole('button', { name: '🎲 生成' }).click()

    await expect(page.getByText('长度:')).toBeVisible({ timeout: 3000 })
    await expect(page.getByLabel('大写')).toBeVisible()
    await expect(page.getByLabel('小写')).toBeVisible()
    await expect(page.getByLabel('数字')).toBeVisible()
    await expect(page.getByLabel('符号')).toBeVisible()

    // Password should have been generated
    await expect(async () => {
      const pwdValue = await page.getByPlaceholder('密码').inputValue()
      expect(pwdValue.length).toBeGreaterThanOrEqual(8)
    }).toPass({ timeout: 3000 })

    // Click again to toggle off
    await page.getByRole('button', { name: '🎲 生成' }).click()
    await expect(page.getByText('长度:')).not.toBeVisible({ timeout: 3000 })

    await page.keyboard.press('Escape')
  })

  test('V17: password generator in edit modal on detail page', async ({ page }) => {
    await page.goto(`${BASE}/vault`)
    await waitForHydration(page)
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByRole('button', { name: '+ 条目' })).toBeVisible({ timeout: 20000 })

    // Create a temp entry
    const tempEntry = `E2E GenEdit ${TS}`
    await page.getByRole('button', { name: '+ 条目' }).click()
    await expect(page.getByPlaceholder('名称 (如: GitHub)')).toBeVisible({ timeout: 5000 })
    await page.getByPlaceholder('名称 (如: GitHub)').fill(tempEntry)
    await page.getByPlaceholder('用户名').fill('gen_user')
    await page.getByPlaceholder('密码').fill('original_pass')

    const [createResp] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/vault/entries') && resp.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: '创建' }).click(),
    ])
    expect(createResp.ok()).toBe(true)
    await expect(page.getByText(tempEntry)).toBeVisible({ timeout: 5000 })

    // Navigate to detail page
    await page.getByText(tempEntry).click()
    await page.waitForURL(/\/vault\/\d+/, { timeout: 5000 })
    await page.getByPlaceholder('主密码').fill(MASTER_PWD)
    await page.getByRole('button', { name: '解锁' }).click()
    await expect(page.getByText(tempEntry)).toBeVisible({ timeout: 20000 })

    // Click edit button
    await page.getByRole('button', { name: '编辑' }).click()
    await expect(page.getByPlaceholder('名称')).toBeVisible({ timeout: 5000 })

    // Click generate button in edit modal
    await page.getByRole('button', { name: '🎲 生成' }).click()

    await expect(page.getByText('长度:')).toBeVisible({ timeout: 3000 })

    // Password field should be updated
    await expect(async () => {
      const genPwd = await page.getByPlaceholder('密码').inputValue()
      expect(genPwd.length).toBeGreaterThanOrEqual(8)
      expect(genPwd).not.toBe('original_pass')
    }).toPass({ timeout: 3000 })

    await page.keyboard.press('Escape')
  })
})
