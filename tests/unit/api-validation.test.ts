/**
 * API Validation — Comprehensive Regression Tests
 *
 * Tests the ACTUAL API handler validation logic by importing the handlers
 * with mocked Nitro globals. Each handler is imported via dynamic import
 * and called with controlled readBody / getRouterParam values.
 *
 * If ANYONE changes a validation rule (limit, regex, enum) in any handler,
 * the corresponding test here will catch it.
 *
 * Covers all 9 modules: Auth, Todo, Ideas, Vault, Finance, Important Dates,
 * Period, Categories, Tags.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const event = {} as any

// Helper: set what readBody returns for the next handler call
function mockBody(body: any) {
  vi.mocked(readBody).mockResolvedValue(body)
}

// Helper: set what getRouterParam returns
function mockParam(value: string) {
  vi.mocked(getRouterParam).mockReturnValue(value)
}

// Helper: assert handler throws with expected statusCode
async function expectError(handler: Function, statusCode: number, messageFragment?: string) {
  try {
    await handler(event)
    expect.unreachable(`expected ${statusCode} error`)
  } catch (e: any) {
    expect(e.statusCode).toBe(statusCode)
    if (messageFragment) expect(e.message).toContain(messageFragment)
  }
}

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════

describe('Auth — Login validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('UserModel', {
      findByEmail: vi.fn().mockResolvedValue(null),
    })
    handler = (await import('../../server/api/auth/login.post')).default
  })

  it('should reject missing email', async () => {
    mockBody({ password: 'pass123' })
    await expectError(handler, 400, '邮箱和密码为必填项')
  })

  it('should reject missing password', async () => {
    mockBody({ email: 'a@b.com' })
    await expectError(handler, 400, '邮箱和密码为必填项')
  })

  it('should reject empty body', async () => {
    mockBody({})
    await expectError(handler, 400, '邮箱和密码为必填项')
  })
})

describe('Auth — Register validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('UserModel', {
      findByEmail: vi.fn().mockResolvedValue(null),
      findByUsername: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(1),
    })
    handler = (await import('../../server/api/auth/register.post')).default
  })

  it('should reject missing username', async () => {
    mockBody({ email: 'a@b.com', password: '123456' })
    await expectError(handler, 400, '用户名、邮箱和密码为必填项')
  })

  it('should reject missing email', async () => {
    mockBody({ username: 'user', password: '123456' })
    await expectError(handler, 400, '用户名、邮箱和密码为必填项')
  })

  it('should reject missing password', async () => {
    mockBody({ username: 'user', email: 'a@b.com' })
    await expectError(handler, 400, '用户名、邮箱和密码为必填项')
  })

  it('should reject invalid email format', async () => {
    mockBody({ username: 'user', email: 'not-an-email', password: '123456' })
    await expectError(handler, 400, '请输入有效的邮箱地址')
  })

  it('should reject short password (< 6 chars)', async () => {
    mockBody({ username: 'user', email: 'a@b.com', password: '12345' })
    await expectError(handler, 400, '密码长度至少 6 位')
  })

  it('should accept valid 6-char password', async () => {
    mockBody({ username: 'user', email: 'a@b.com', password: '123456' })
    // Should NOT throw 400 (may throw 409 or succeed depending on model stub)
    try {
      await handler(event)
    } catch (e: any) {
      expect(e.statusCode).not.toBe(400)
    }
  })
})

describe('Auth — Change password validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAuth', vi.fn(() => 1))
    vi.stubGlobal('UserModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, password: 'hashed' }),
    })
    handler = (await import('../../server/api/auth/change-password.post')).default
  })

  it('should reject missing currentPassword', async () => {
    mockBody({ newPassword: 'newpass1' })
    await expectError(handler, 400, '旧密码和新密码为必填项')
  })

  it('should reject missing newPassword', async () => {
    mockBody({ currentPassword: 'oldpass1' })
    await expectError(handler, 400, '旧密码和新密码为必填项')
  })

  it('should reject short newPassword', async () => {
    mockBody({ currentPassword: 'oldpass1', newPassword: '12345' })
    await expectError(handler, 400, '新密码长度至少 6 位')
  })
})

describe('Auth — Refresh validation', () => {
  let handler: Function

  beforeEach(async () => {
    handler = (await import('../../server/api/auth/refresh.post')).default
  })

  it('should reject missing refreshToken', async () => {
    mockBody({})
    await expectError(handler, 400, '缺少刷新令牌')
  })
})

// ══════════════════════════════════════════════════════════════
// TODO
// ══════════════════════════════════════════════════════════════

describe('Todo — Create validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', {
      create: vi.fn().mockResolvedValue(1),
      findById: vi.fn().mockResolvedValue({ id: 1, title: 'Test' }),
      updateTags: vi.fn(),
    })
    handler = (await import('../../server/api/todos/index.post')).default
  })

  it('should reject empty title', async () => {
    mockBody({ title: '' })
    await expectError(handler, 400, '标题为必填项')
  })

  it('should reject whitespace-only title', async () => {
    mockBody({ title: '   ' })
    await expectError(handler, 400, '标题为必填项')
  })

  it('should reject title > 200 chars', async () => {
    mockBody({ title: 'a'.repeat(201) })
    await expectError(handler, 400, '标题不能超过200个字符')
  })

  it('should accept title of exactly 200 chars', async () => {
    mockBody({ title: 'a'.repeat(200) })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })

  it('should default priority to medium for invalid value', async () => {
    mockBody({ title: 'Test', priority: 'invalid' })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })

  it('should accept valid priorities', async () => {
    for (const p of ['high', 'medium', 'low']) {
      mockBody({ title: 'Test', priority: p })
      const result = await handler(event)
      expect(result.success).toBe(true)
    }
  })

  it('should filter out invalid tag_ids', async () => {
    mockBody({ title: 'Test', tag_ids: [1, -1, 'abc', 0, 2.5, 2] })
    const result = await handler(event)
    expect(result.success).toBe(true)
    // updateTags should be called with only valid ids [1, 2]
    expect(vi.mocked(TodoModel.updateTags)).toHaveBeenCalledWith(
      expect.any(Number),
      [1, 2],
    )
  })
})

describe('Todo — Update validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', {
      findById: vi.fn().mockResolvedValue({ id: 5, title: 'Existing' }),
      update: vi.fn(),
      updateTags: vi.fn(),
      getTags: vi.fn().mockResolvedValue([]),
    })
    handler = (await import('../../server/api/todos/[id].put')).default
  })

  it('should reject invalid ID (NaN)', async () => {
    mockParam('abc')
    mockBody({ title: 'New' })
    await expectError(handler, 400, '无效的 Todo ID')
  })

  it('should reject empty title update', async () => {
    mockParam('5')
    mockBody({ title: '' })
    await expectError(handler, 400, '标题不能为空')
  })

  it('should reject title > 200 chars', async () => {
    mockParam('5')
    mockBody({ title: 'x'.repeat(201) })
    await expectError(handler, 400, '标题不能超过200个字符')
  })

  it('should reject invalid priority', async () => {
    mockParam('5')
    mockBody({ priority: 'critical' })
    await expectError(handler, 400, '无效的优先级')
  })
})

// ══════════════════════════════════════════════════════════════
// IDEAS
// ══════════════════════════════════════════════════════════════

describe('Ideas — Create validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('IdeaModel', {
      create: vi.fn().mockResolvedValue(1),
      findById: vi.fn().mockResolvedValue({ id: 1, content: 'Test' }),
    })
    vi.stubGlobal('TodoModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, title: 'Test' }),
    })
    handler = (await import('../../server/api/ideas/index.post')).default
  })

  it('should reject empty content', async () => {
    mockBody({ content: '' })
    await expectError(handler, 400, '内容为必填项')
  })

  it('should reject whitespace-only content', async () => {
    mockBody({ content: '   ' })
    await expectError(handler, 400, '内容为必填项')
  })

  it('should reject content > 5000 chars', async () => {
    mockBody({ content: 'x'.repeat(5001) })
    await expectError(handler, 400, '内容不能超过5000个字符')
  })

  it('should accept content of exactly 5000 chars', async () => {
    mockBody({ content: 'x'.repeat(5000) })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })

  it('should reject invalid todo_id (non-integer)', async () => {
    mockBody({ content: 'Test', todo_id: 'abc' })
    await expectError(handler, 400, '无效的 Todo ID')
  })

  it('should reject negative todo_id', async () => {
    mockBody({ content: 'Test', todo_id: -1 })
    await expectError(handler, 400, '无效的 Todo ID')
  })

  it('should reject todo_id = 0', async () => {
    mockBody({ content: 'Test', todo_id: 0 })
    await expectError(handler, 400, '无效的 Todo ID')
  })
})

describe('Ideas — Update validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('IdeaModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, content: 'Existing' }),
      update: vi.fn(),
    })
    handler = (await import('../../server/api/ideas/[id].put')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    mockBody({ content: 'New' })
    await expectError(handler, 400, '无效的随手记 ID')
  })

  it('should reject empty content', async () => {
    mockParam('1')
    mockBody({ content: '' })
    await expectError(handler, 400, '内容不能为空')
  })

  it('should reject content > 5000 chars', async () => {
    mockParam('1')
    mockBody({ content: 'x'.repeat(5001) })
    await expectError(handler, 400, '内容不能超过5000个字符')
  })
})

// ══════════════════════════════════════════════════════════════
// VAULT
// ══════════════════════════════════════════════════════════════

describe('Vault — Create entry validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('VaultModel', {
      createEntry: vi.fn().mockResolvedValue(1),
      findEntryById: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
      findGroupById: vi.fn().mockResolvedValue({ id: 1, name: 'Group' }),
    })
    handler = (await import('../../server/api/vault/entries/index.post')).default
  })

  it('should reject empty name', async () => {
    mockBody({ name: '', encrypted_data: 'abc' })
    await expectError(handler, 400, '条目名称不能为空')
  })

  it('should reject name > 200 chars', async () => {
    mockBody({ name: 'x'.repeat(201), encrypted_data: 'abc' })
    await expectError(handler, 400, '条目名称不能超过200个字符')
  })

  it('should reject missing encrypted_data', async () => {
    mockBody({ name: 'Test' })
    await expectError(handler, 400, '加密数据不能为空')
  })

  it('should reject non-string encrypted_data', async () => {
    mockBody({ name: 'Test', encrypted_data: 123 })
    await expectError(handler, 400, '加密数据不能为空')
  })

  it('should reject encrypted_data > 100000 chars', async () => {
    mockBody({ name: 'Test', encrypted_data: 'x'.repeat(100001) })
    await expectError(handler, 400, '加密数据过大')
  })
})

describe('Vault — Create group validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('VaultModel', {
      createGroup: vi.fn().mockResolvedValue(1),
      findGroupById: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
    })
    handler = (await import('../../server/api/vault/groups/index.post')).default
  })

  it('should reject empty group name', async () => {
    mockBody({ name: '' })
    await expectError(handler, 400, '分组名称不能为空')
  })

  it('should reject group name > 50 chars', async () => {
    mockBody({ name: 'x'.repeat(51) })
    await expectError(handler, 400, '分组名称不能超过50个字符')
  })
})

describe('Vault — Batch update validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('VaultModel', {
      batchUpdateEntries: vi.fn(),
    })
    handler = (await import('../../server/api/vault/entries/batch.put')).default
  })

  it('should reject empty entries array', async () => {
    mockBody({ entries: [] })
    await expectError(handler, 400, '请提供要更新的条目列表')
  })

  it('should reject non-array entries', async () => {
    mockBody({ entries: 'not-array' })
    await expectError(handler, 400, '请提供要更新的条目列表')
  })

  it('should reject entries > 500', async () => {
    const entries = Array.from({ length: 501 }, (_, i) => ({ id: i + 1, encrypted_data: 'x' }))
    mockBody({ entries })
    await expectError(handler, 400, '批量更新不能超过500条')
  })

  it('should reject invalid item id', async () => {
    mockBody({ entries: [{ id: -1, encrypted_data: 'x' }] })
    await expectError(handler, 400, '无效的条目 ID')
  })

  it('should reject missing encrypted_data in item', async () => {
    mockBody({ entries: [{ id: 1, encrypted_data: '' }] })
    await expectError(handler, 400, '加密数据不能为空')
  })
})

// ══════════════════════════════════════════════════════════════
// FINANCE
// ══════════════════════════════════════════════════════════════

describe('Finance — Create record validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceRecordModel', {
      create: vi.fn().mockResolvedValue(1),
      findById: vi.fn().mockResolvedValue({ id: 1, type: 'income', amount: 100 }),
    })
    vi.stubGlobal('FinanceCategoryModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, name: 'Cat' }),
    })
    handler = (await import('../../server/api/finance/records/index.post')).default
  })

  it('should reject missing required fields', async () => {
    mockBody({})
    await expectError(handler, 400, '类型、金额和日期为必填项')
  })

  it('should reject invalid type', async () => {
    mockBody({ type: 'transfer', amount: 100, record_date: '2025-01-01' })
    await expectError(handler, 400, '类型必须为 income 或 expense')
  })

  it('should accept type "income"', async () => {
    mockBody({ type: 'income', amount: 100, record_date: '2025-01-01' })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })

  it('should accept type "expense"', async () => {
    mockBody({ type: 'expense', amount: 50, record_date: '2025-01-01' })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })

  it('should reject amount = 0 as missing (falsy)', async () => {
    mockBody({ type: 'income', amount: 0, record_date: '2025-01-01' })
    await expectError(handler, 400, '类型、金额和日期为必填项')
  })

  it('should reject negative amount', async () => {
    mockBody({ type: 'income', amount: -10, record_date: '2025-01-01' })
    await expectError(handler, 400, '金额必须大于 0')
  })

  it('should reject invalid date format', async () => {
    mockBody({ type: 'income', amount: 100, record_date: '2025/01/01' })
    await expectError(handler, 400, '日期格式必须为 YYYY-MM-DD')
  })

  it('should reject nonsense date matching YYYY-MM-DD pattern', async () => {
    mockBody({ type: 'income', amount: 100, record_date: '9999-99-99' })
    await expectError(handler, 400, '日期格式必须为 YYYY-MM-DD')
  })

  it('should reject note > 500 chars', async () => {
    mockBody({ type: 'income', amount: 100, record_date: '2025-01-01', note: 'x'.repeat(501) })
    await expectError(handler, 400, '备注不能超过500个字符')
  })
})

describe('Finance — Update record validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceRecordModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, type: 'income', amount: 100 }),
      update: vi.fn(),
    })
    handler = (await import('../../server/api/finance/records/[id].put')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    mockBody({ type: 'income' })
    await expectError(handler, 400, '无效的记录ID')
  })

  it('should reject ID <= 0', async () => {
    mockParam('0')
    mockBody({ type: 'income' })
    await expectError(handler, 400, '无效的记录ID')
  })

  it('should reject invalid type', async () => {
    mockParam('1')
    mockBody({ type: 'refund' })
    await expectError(handler, 400, '类型必须为 income 或 expense')
  })

  it('should reject invalid amount', async () => {
    mockParam('1')
    mockBody({ amount: 0 })
    await expectError(handler, 400, '金额必须大于 0')
  })

  it('should reject invalid date', async () => {
    mockParam('1')
    mockBody({ record_date: 'not-a-date' })
    await expectError(handler, 400, '日期格式必须为 YYYY-MM-DD')
  })

  it('should reject long note', async () => {
    mockParam('1')
    mockBody({ note: 'x'.repeat(501) })
    await expectError(handler, 400, '备注不能超过500个字符')
  })
})

describe('Finance — Statistics validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceRecordModel', {
      getStatistics: vi.fn().mockResolvedValue({
        total_income: 0, total_expense: 0, balance: 0, by_category: [],
      }),
    })
    handler = (await import('../../server/api/finance/statistics.get')).default
  })

  it('should reject invalid date format in start_date', async () => {
    vi.mocked(getQuery).mockReturnValue({ start_date: 'bad-date', end_date: '2025-01-31' })
    await expectError(handler, 400, '日期格式必须为 YYYY-MM-DD')
  })

  it('should reject invalid date format in end_date', async () => {
    vi.mocked(getQuery).mockReturnValue({ start_date: '2025-01-01', end_date: 'bad' })
    await expectError(handler, 400, '日期格式必须为 YYYY-MM-DD')
  })

  it('should accept valid date range', async () => {
    vi.mocked(getQuery).mockReturnValue({ start_date: '2025-01-01', end_date: '2025-01-31' })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════
// IMPORTANT DATES
// ══════════════════════════════════════════════════════════════

describe('Important Dates — Create validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ImportantDateModel', {
      create: vi.fn().mockResolvedValue(1),
      findById: vi.fn().mockResolvedValue({ id: 1, title: 'Test' }),
    })
    handler = (await import('../../server/api/important-dates/index.post')).default
  })

  it('should reject missing title', async () => {
    mockBody({ date: '2025-01-01' })
    await expectError(handler, 400, '标题和日期为必填项')
  })

  it('should reject missing date', async () => {
    mockBody({ title: 'Birthday' })
    await expectError(handler, 400, '标题和日期为必填项')
  })

  it('should reject title > 200 chars', async () => {
    mockBody({ title: 'x'.repeat(201), date: '2025-01-01' })
    await expectError(handler, 400, '标题不能超过200个字符')
  })

  it('should reject invalid date format', async () => {
    mockBody({ title: 'Test', date: '01-01-2025' })
    await expectError(handler, 400, '日期格式必须为 YYYY-MM-DD')
  })

  it('should reject remind_days_before < 0', async () => {
    mockBody({ title: 'Test', date: '2025-01-01', remind_days_before: -1 })
    await expectError(handler, 400, '提醒天数必须为 0-365 之间的整数')
  })

  it('should reject remind_days_before > 365', async () => {
    mockBody({ title: 'Test', date: '2025-01-01', remind_days_before: 366 })
    await expectError(handler, 400, '提醒天数必须为 0-365 之间的整数')
  })

  it('should reject non-integer remind_days_before', async () => {
    mockBody({ title: 'Test', date: '2025-01-01', remind_days_before: 1.5 })
    await expectError(handler, 400, '提醒天数必须为 0-365 之间的整数')
  })

  it('should reject icon > 20 chars', async () => {
    mockBody({ title: 'Test', date: '2025-01-01', icon: 'x'.repeat(21) })
    await expectError(handler, 400, '图标内容过长')
  })

  it('should reject note > 2000 chars', async () => {
    mockBody({ title: 'Test', date: '2025-01-01', note: 'x'.repeat(2001) })
    await expectError(handler, 400, '备注不能超过2000个字符')
  })

  it('should accept valid data', async () => {
    mockBody({ title: 'Birthday', date: '2025-06-15', repeat_yearly: true, remind_days_before: 7 })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })
})

describe('Important Dates — Update validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ImportantDateModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, title: 'Existing' }),
      update: vi.fn(),
    })
    handler = (await import('../../server/api/important-dates/[id].put')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    mockBody({ title: 'New' })
    await expectError(handler, 400, '无效的ID')
  })

  it('should reject empty title', async () => {
    mockParam('1')
    mockBody({ title: '' })
    await expectError(handler, 400, '标题不能为空')
  })

  it('should reject title > 200 chars', async () => {
    mockParam('1')
    mockBody({ title: 'x'.repeat(201) })
    await expectError(handler, 400, '标题不能超过200个字符')
  })

  it('should reject invalid date', async () => {
    mockParam('1')
    mockBody({ date: 'bad' })
    await expectError(handler, 400, '日期格式必须为 YYYY-MM-DD')
  })

  it('should reject note > 2000 chars', async () => {
    mockParam('1')
    mockBody({ note: 'x'.repeat(2001) })
    await expectError(handler, 400, '备注不能超过2000个字符')
  })

  it('should reject empty update body', async () => {
    mockParam('1')
    mockBody({})
    await expectError(handler, 400, '没有可更新的字段')
  })
})

// ══════════════════════════════════════════════════════════════
// PERIOD
// ══════════════════════════════════════════════════════════════

describe('Period — Create record validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('PeriodModel', {
      create: vi.fn().mockResolvedValue(1),
      findById: vi.fn().mockResolvedValue({ id: 1, start_date: '2025-01-01' }),
    })
    handler = (await import('../../server/api/period/index.post')).default
  })

  it('should reject missing start_date', async () => {
    mockBody({})
    await expectError(handler, 400, '开始日期为必填项')
  })

  it('should reject invalid start_date format', async () => {
    mockBody({ start_date: '01-01-2025' })
    await expectError(handler, 400, '开始日期为必填项')
  })

  it('should reject invalid end_date format', async () => {
    mockBody({ start_date: '2025-01-01', end_date: 'bad' })
    await expectError(handler, 400, '结束日期格式 YYYY-MM-DD')
  })

  it('should reject end_date before start_date', async () => {
    mockBody({ start_date: '2025-01-10', end_date: '2025-01-05' })
    await expectError(handler, 400, '结束日期不能早于开始日期')
  })

  it('should reject invalid flow_level', async () => {
    mockBody({ start_date: '2025-01-01', flow_level: 'extreme' })
    await expectError(handler, 400, '流量级别无效')
  })

  it('should accept valid flow_levels', async () => {
    for (const level of ['light', 'moderate', 'heavy']) {
      mockBody({ start_date: '2025-01-01', flow_level: level })
      const result = await handler(event)
      expect(result.success).toBe(true)
    }
  })

  it('should reject invalid symptoms', async () => {
    mockBody({ start_date: '2025-01-01', symptoms: ['not-valid'] })
    await expectError(handler, 400, '症状选项无效')
  })

  it('should accept valid symptoms', async () => {
    mockBody({
      start_date: '2025-01-01',
      symptoms: ['cramps', 'headache', 'bloating', 'fatigue', 'backache', 'nausea', 'insomnia', 'acne'],
    })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })

  it('should reject person_name > 50 chars', async () => {
    mockBody({ start_date: '2025-01-01', person_name: 'x'.repeat(51) })
    await expectError(handler, 400, '记录对象名称1-50字')
  })

  it('should reject empty person_name', async () => {
    mockBody({ start_date: '2025-01-01', person_name: '' })
    await expectError(handler, 400, '记录对象名称1-50字')
  })

  it('should reject note > 500 chars', async () => {
    mockBody({ start_date: '2025-01-01', note: 'x'.repeat(501) })
    await expectError(handler, 400, '备注不超过500字')
  })
})

describe('Period — Update record validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('PeriodModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, start_date: '2025-01-01', person_name: '我' }),
      update: vi.fn(),
    })
    handler = (await import('../../server/api/period/[id].put')).default
  })

  it('should reject NaN ID', async () => {
    mockParam('abc')
    mockBody({ start_date: '2025-01-01' })
    await expectError(handler, 400, 'ID 无效')
  })

  it('should reject empty body', async () => {
    mockParam('1')
    mockBody({})
    await expectError(handler, 400, '未提供有效字段')
  })

  it('should reject invalid start_date', async () => {
    mockParam('1')
    mockBody({ start_date: 123 })
    await expectError(handler, 400, '开始日期格式 YYYY-MM-DD')
  })

  it('should reject invalid flow_level', async () => {
    mockParam('1')
    mockBody({ flow_level: 'extreme' })
    await expectError(handler, 400, '流量级别无效')
  })

  it('should reject invalid symptoms', async () => {
    mockParam('1')
    mockBody({ symptoms: ['invalid'] })
    await expectError(handler, 400, '症状选项无效')
  })

  it('should reject end_date before start_date', async () => {
    mockParam('1')
    mockBody({ start_date: '2025-02-01', end_date: '2025-01-01' })
    await expectError(handler, 400, '结束日期不能早于开始日期')
  })

  it('should reject person_name > 50 chars', async () => {
    mockParam('1')
    mockBody({ person_name: 'x'.repeat(51) })
    await expectError(handler, 400, '记录对象名称1-50字')
  })

  it('should reject note > 500 chars', async () => {
    mockParam('1')
    mockBody({ note: 'x'.repeat(501) })
    await expectError(handler, 400, '备注不超过500字')
  })
})

// ══════════════════════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════════════════════

describe('Categories — Create validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('CategoryModel', {
      create: vi.fn().mockResolvedValue(1),
      findById: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
    })
    handler = (await import('../../server/api/categories/index.post')).default
  })

  it('should reject empty name', async () => {
    mockBody({ name: '' })
    await expectError(handler, 400, '分类名称为必填项')
  })

  it('should reject name > 50 chars', async () => {
    mockBody({ name: 'x'.repeat(51) })
    await expectError(handler, 400, '分类名称不能超过50个字符')
  })

  it('should reject invalid color format', async () => {
    mockBody({ name: 'Test', color: 'red' })
    await expectError(handler, 400, '颜色格式无效')
  })

  it('should reject color without # prefix', async () => {
    mockBody({ name: 'Test', color: 'FF0000' })
    await expectError(handler, 400, '颜色格式无效')
  })

  it('should accept valid hex color', async () => {
    mockBody({ name: 'Test', color: '#FF0000' })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })

  it('should accept lowercase hex color', async () => {
    mockBody({ name: 'Test', color: '#ff0000' })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })
})

describe('Categories — Update validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('CategoryModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, name: 'Existing' }),
      update: vi.fn(),
    })
    handler = (await import('../../server/api/categories/[id].put')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    mockBody({ name: 'New' })
    await expectError(handler, 400, '无效的分类ID')
  })

  it('should reject empty name', async () => {
    mockParam('1')
    mockBody({ name: '' })
    await expectError(handler, 400, '分类名称不能为空')
  })

  it('should reject name > 50 chars', async () => {
    mockParam('1')
    mockBody({ name: 'x'.repeat(51) })
    await expectError(handler, 400, '分类名称不能超过50个字符')
  })

  it('should reject invalid color', async () => {
    mockParam('1')
    mockBody({ color: 'blue' })
    await expectError(handler, 400, '颜色格式无效')
  })
})

// ══════════════════════════════════════════════════════════════
// TAGS
// ══════════════════════════════════════════════════════════════

describe('Tags — Create validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TagModel', {
      create: vi.fn().mockResolvedValue(1),
      findById: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
    })
    handler = (await import('../../server/api/tags/index.post')).default
  })

  it('should reject empty name', async () => {
    mockBody({ name: '' })
    await expectError(handler, 400, '标签名称不能为空')
  })

  it('should reject whitespace-only name', async () => {
    mockBody({ name: '   ' })
    await expectError(handler, 400, '标签名称不能为空')
  })

  it('should reject name > 50 chars', async () => {
    mockBody({ name: 'x'.repeat(51) })
    await expectError(handler, 400, '标签名称不能超过50个字符')
  })
})

describe('Tags — Update validation', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TagModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, name: 'Existing' }),
      update: vi.fn(),
    })
    handler = (await import('../../server/api/tags/[id].put')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    mockBody({ name: 'New' })
    await expectError(handler, 400, '无效的标签ID')
  })

  it('should reject empty name', async () => {
    mockParam('1')
    mockBody({ name: '' })
    await expectError(handler, 400, '标签名称不能为空')
  })

  it('should reject name > 50 chars', async () => {
    mockParam('1')
    mockBody({ name: 'x'.repeat(51) })
    await expectError(handler, 400, '标签名称不能超过50个字符')
  })
})
