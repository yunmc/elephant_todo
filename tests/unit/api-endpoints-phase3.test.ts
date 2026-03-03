/**
 * API Endpoints — Phase 3 Regression Tests
 *
 * Tests all previously-untested endpoints (list, delete, happy paths)
 * and fills partial-coverage gaps (404 paths, happy paths for already-validated).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const event = {} as any

function mockBody(body: any) { vi.mocked(readBody).mockResolvedValue(body) }
function mockParam(value: string) { vi.mocked(getRouterParam).mockReturnValue(value) }
function mockParams(params: Record<string, string>) {
  vi.mocked(getRouterParam).mockImplementation((_e: any, name: string) => params[name])
}
function mockQuery(query: Record<string, any>) { vi.mocked(getQuery).mockReturnValue(query) }
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
// AUTH — Login happy path
// ══════════════════════════════════════════════════════════════

describe('Auth — Login (happy & error paths)', () => {
  let handler: Function

  beforeEach(async () => {
    // bcrypt.hash('correct', 12) → stored hash
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash('correct', 4) // Use cost=4 for speed
    vi.stubGlobal('UserModel', {
      findByEmail: vi.fn().mockResolvedValue({ id: 1, username: 'alice', email: 'a@b.com', password: hash }),
    })
    handler = (await import('../../server/api/auth/login.post')).default
  })

  it('should return 401 when user not found', async () => {
    vi.mocked(UserModel.findByEmail).mockResolvedValue(null)
    mockBody({ email: 'x@y.com', password: '123456' })
    await expectError(handler, 401, '邮箱或密码错误')
  })

  it('should return 401 when password is wrong', async () => {
    mockBody({ email: 'a@b.com', password: 'wrong-password' })
    await expectError(handler, 401, '邮箱或密码错误')
  })

  it('should login successfully with correct password', async () => {
    mockBody({ email: 'a@b.com', password: 'correct' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.user.email).toBe('a@b.com')
    expect(result.data.accessToken).toBeDefined()
    expect(result.data.refreshToken).toBeDefined()
    expect(result.message).toContain('登录成功')
  })
})

// ══════════════════════════════════════════════════════════════
// AUTH — Register happy path
// ══════════════════════════════════════════════════════════════

describe('Auth — Register (happy & error paths)', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('UserModel', {
      findByEmail: vi.fn().mockResolvedValue(null),
      findByUsername: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(1),
    })
    handler = (await import('../../server/api/auth/register.post')).default
  })

  it('should return 409 when email already exists', async () => {
    vi.mocked(UserModel.findByEmail).mockResolvedValue({ id: 1 })
    mockBody({ username: 'alice', email: 'a@b.com', password: '123456' })
    await expectError(handler, 409, '该邮箱已被注册')
  })

  it('should return 409 when username already taken', async () => {
    vi.mocked(UserModel.findByUsername).mockResolvedValue({ id: 1 })
    mockBody({ username: 'alice', email: 'a@b.com', password: '123456' })
    await expectError(handler, 409, '该用户名已被占用')
  })

  it('should handle ER_DUP_ENTRY on email', async () => {
    const err = new Error('Duplicate entry') as any
    err.code = 'ER_DUP_ENTRY'
    err.message = 'uk_users_email dup'
    vi.mocked(UserModel.create).mockRejectedValue(err)
    mockBody({ username: 'alice', email: 'a@b.com', password: '123456' })
    await expectError(handler, 409, '该邮箱已被注册')
  })

  it('should register successfully', async () => {
    mockBody({ username: 'alice', email: 'a@b.com', password: '123456' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.user.username).toBe('alice')
    expect(result.data.accessToken).toBeDefined()
    expect(result.message).toContain('注册成功')
  })
})

// ══════════════════════════════════════════════════════════════
// AUTH — Change Password happy path
// ══════════════════════════════════════════════════════════════

describe('Auth — Change Password (happy & error paths)', () => {
  let handler: Function

  beforeEach(async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash('oldpass', 4)
    vi.stubGlobal('UserModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, email: 'a@b.com', password: hash }),
      updatePassword: vi.fn(),
    })
    handler = (await import('../../server/api/auth/change-password.post')).default
  })

  it('should return 404 if user not found', async () => {
    vi.mocked(UserModel.findById).mockResolvedValue(null)
    mockBody({ currentPassword: 'old', newPassword: '123456' })
    await expectError(handler, 404, '用户不存在')
  })

  it('should return 401 if old password wrong', async () => {
    mockBody({ currentPassword: 'wrong', newPassword: '123456' })
    await expectError(handler, 401, '旧密码错误')
  })

  it('should change password successfully', async () => {
    mockBody({ currentPassword: 'oldpass', newPassword: 'newpass123' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('密码修改成功')
    expect(result.data.accessToken).toBeDefined()
    expect(UserModel.updatePassword).toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════
// AUTH — Refresh (happy & error paths)
// ══════════════════════════════════════════════════════════════

describe('Auth — Refresh Token', () => {
  let handler: Function

  beforeEach(async () => {
    handler = (await import('../../server/api/auth/refresh.post')).default
  })

  it('should return 401 for invalid refresh token', async () => {
    mockBody({ refreshToken: 'totally-invalid-token' })
    await expectError(handler, 401, '刷新令牌无效或已过期')
  })

  it('should refresh tokens when given valid token', async () => {
    // Generate a valid refresh token
    const jwt = await import('jsonwebtoken')
    const config = useRuntimeConfig()
    const validToken = jwt.default.sign(
      { userId: 1, email: 'a@b.com' },
      config.jwtRefreshSecret as string,
      { expiresIn: '7d' }
    )
    mockBody({ refreshToken: validToken })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.accessToken).toBeDefined()
    expect(result.data.refreshToken).toBeDefined()
  })
})

// ══════════════════════════════════════════════════════════════
// GET /api/todos — List with query param validation
// ══════════════════════════════════════════════════════════════

describe('Todos — List (GET /api/todos)', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', {
      findByUser: vi.fn().mockResolvedValue({ todos: [], total: 0 }),
      getTagsBatch: vi.fn().mockResolvedValue(new Map()),
      getIdeasCountBatch: vi.fn().mockResolvedValue(new Map()),
    })
    handler = (await import('../../server/api/todos/index.get')).default
  })

  it('should return paginated response', async () => {
    mockQuery({})
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.pagination).toBeDefined()
    expect(result.pagination.page).toBe(1)
    expect(result.pagination.limit).toBe(20)
  })

  it('should sanitize invalid status (ignored)', async () => {
    mockQuery({ status: 'hacked' })
    await handler(event)
    const call = vi.mocked(TodoModel.findByUser).mock.calls[0]
    expect(call[1].status).toBeUndefined()
  })

  it('should pass valid status', async () => {
    mockQuery({ status: 'pending' })
    await handler(event)
    const call = vi.mocked(TodoModel.findByUser).mock.calls[0]
    expect(call[1].status).toBe('pending')
  })

  it('should sanitize invalid priority', async () => {
    mockQuery({ priority: 'critical' })
    await handler(event)
    const call = vi.mocked(TodoModel.findByUser).mock.calls[0]
    expect(call[1].priority).toBeUndefined()
  })

  it('should sanitize invalid sort_by to created_at', async () => {
    mockQuery({ sort_by: 'DROP TABLE' })
    await handler(event)
    const call = vi.mocked(TodoModel.findByUser).mock.calls[0]
    expect(call[1].sort_by).toBe('created_at')
  })

  it('should sanitize invalid sort_order to desc', async () => {
    mockQuery({ sort_order: 'invalid' })
    await handler(event)
    const call = vi.mocked(TodoModel.findByUser).mock.calls[0]
    expect(call[1].sort_order).toBe('desc')
  })

  it('should sanitize invalid due_filter', async () => {
    mockQuery({ due_filter: 'all' })
    await handler(event)
    const call = vi.mocked(TodoModel.findByUser).mock.calls[0]
    expect(call[1].due_filter).toBeUndefined()
  })

  it('should clamp limit to 1-100', async () => {
    mockQuery({ limit: '500' })
    await handler(event)
    const call = vi.mocked(TodoModel.findByUser).mock.calls[0]
    expect(call[1].limit).toBe(100)
  })

  it('should slice search to 100 chars', async () => {
    mockQuery({ search: 'x'.repeat(200) })
    await handler(event)
    const call = vi.mocked(TodoModel.findByUser).mock.calls[0]
    expect(call[1].search).toHaveLength(100)
  })

  it('should enrich todos with tags and ideas_count from batch helpers', async () => {
    vi.mocked(TodoModel.findByUser).mockResolvedValue({
      todos: [{ id: 1, title: 'T1' }, { id: 2, title: 'T2' }], total: 2
    })
    const tagsMap = new Map([[1, [{ id: 10, name: 'tag1' }]], [2, []]])
    const ideasMap = new Map([[1, 3], [2, 0]])
    vi.mocked(TodoModel.getTagsBatch).mockResolvedValue(tagsMap)
    vi.mocked(TodoModel.getIdeasCountBatch).mockResolvedValue(ideasMap)
    mockQuery({})
    const result = await handler(event)
    expect(result.data[0].tags).toEqual([{ id: 10, name: 'tag1' }])
    expect(result.data[0].ideas_count).toBe(3)
    expect(result.data[1].tags).toEqual([])
    expect(result.data[1].ideas_count).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════
// GET /api/ideas — List
// ══════════════════════════════════════════════════════════════

describe('Ideas — List (GET /api/ideas)', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('IdeaModel', {
      findByUser: vi.fn().mockResolvedValue({ ideas: [], total: 0 }),
    })
    handler = (await import('../../server/api/ideas/index.get')).default
  })

  it('should return paginated response', async () => {
    mockQuery({})
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.pagination).toBeDefined()
  })

  it('should sanitize invalid linked param', async () => {
    mockQuery({ linked: 'maybe' })
    await handler(event)
    const call = vi.mocked(IdeaModel.findByUser).mock.calls[0]
    expect(call[1].linked).toBeUndefined()
  })

  it('should sanitize invalid source', async () => {
    mockQuery({ source: 'hacked' })
    await handler(event)
    const call = vi.mocked(IdeaModel.findByUser).mock.calls[0]
    expect(call[1].source).toBeUndefined()
  })

  it('should slice search to 100 chars', async () => {
    mockQuery({ search: 'x'.repeat(200) })
    await handler(event)
    const call = vi.mocked(IdeaModel.findByUser).mock.calls[0]
    expect(call[1].search).toHaveLength(100)
  })
})

// ══════════════════════════════════════════════════════════════
// Subtasks — List + Update
// ══════════════════════════════════════════════════════════════

describe('Subtasks — List (GET /api/todos/[id]/subtasks)', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', { findById: vi.fn().mockResolvedValue({ id: 1 }) })
    vi.stubGlobal('SubtaskModel', { findByTodo: vi.fn().mockResolvedValue([{ id: 1, title: 'S1' }]) })
    handler = (await import('../../server/api/todos/[id]/subtasks/index.get')).default
  })

  it('should return 404 if todo not found', async () => {
    vi.mocked(TodoModel.findById).mockResolvedValue(null)
    mockParam('1')
    await expectError(handler, 404, 'Todo 不存在')
  })

  it('should return subtasks on success', async () => {
    mockParam('1')
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })
})

describe('Subtasks — Update (PUT /api/todos/[id]/subtasks/[subtaskId])', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', { findById: vi.fn().mockResolvedValue({ id: 1 }) })
    vi.stubGlobal('SubtaskModel', {
      update: vi.fn().mockResolvedValue(true),
      findById: vi.fn().mockResolvedValue({ id: 2, title: 'Updated', status: 'completed' }),
    })
    handler = (await import('../../server/api/todos/[id]/subtasks/[subtaskId]/index.put')).default
  })

  it('should return 404 if todo not found', async () => {
    mockParams({ id: '1', subtaskId: '2' })
    vi.mocked(TodoModel.findById).mockResolvedValue(null)
    mockBody({ title: 'X' })
    await expectError(handler, 404, 'Todo 不存在')
  })

  it('should return 404 if subtask not found (update returns false)', async () => {
    mockParams({ id: '1', subtaskId: '2' })
    vi.mocked(SubtaskModel.update).mockResolvedValue(false)
    mockBody({ title: 'X' })
    await expectError(handler, 404, '子任务不存在')
  })

  it('should update subtask on success', async () => {
    mockParams({ id: '1', subtaskId: '2' })
    mockBody({ title: 'Updated', status: 'completed' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.title).toBe('Updated')
  })
})

// ══════════════════════════════════════════════════════════════
// Vault — Entries List + Entry Update + Groups List + Group Create
// ══════════════════════════════════════════════════════════════

describe('Vault — Entries List', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('VaultModel', {
      findEntries: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
    })
    handler = (await import('../../server/api/vault/entries/index.get')).default
  })

  it('should return paginated response', async () => {
    mockQuery({})
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.pagination).toBeDefined()
  })
})

describe('Vault — Entry Update', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('VaultModel', {
      findEntryById: vi.fn().mockResolvedValue({ id: 1, name: 'Old' }),
      updateEntry: vi.fn(),
    })
    handler = (await import('../../server/api/vault/entries/[id].put')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    mockBody({ name: 'New' })
    await expectError(handler, 400, '无效的条目ID')
  })

  it('should return 404 if entry not found', async () => {
    mockParam('1')
    vi.mocked(VaultModel.findEntryById).mockResolvedValue(null)
    mockBody({ name: 'New' })
    await expectError(handler, 404, '条目不存在')
  })

  it('should reject empty name', async () => {
    mockParam('1')
    mockBody({ name: '  ' })
    await expectError(handler, 400, '条目名称不能为空')
  })

  it('should reject name > 200 chars', async () => {
    mockParam('1')
    mockBody({ name: 'x'.repeat(201) })
    await expectError(handler, 400, '条目名称不能超过200个字符')
  })

  it('should reject non-string encrypted_data', async () => {
    mockParam('1')
    mockBody({ encrypted_data: 12345 })
    await expectError(handler, 400, '加密数据无效')
  })

  it('should reject encrypted_data > 100000 chars', async () => {
    mockParam('1')
    mockBody({ encrypted_data: 'x'.repeat(100001) })
    await expectError(handler, 400, '加密数据无效')
  })

  it('should update entry on success', async () => {
    mockParam('1')
    mockBody({ name: 'Updated' })
    vi.mocked(VaultModel.findEntryById)
      .mockResolvedValueOnce({ id: 1, name: 'Old' })
      .mockResolvedValueOnce({ id: 1, name: 'Updated' })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })
})

describe('Vault — Groups List', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('VaultModel', {
      findGroups: vi.fn().mockResolvedValue([{ id: 1, name: 'G1' }]),
    })
    handler = (await import('../../server/api/vault/groups/index.get')).default
  })

  it('should return groups', async () => {
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })
})

describe('Vault — Group Create', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('VaultModel', {
      createGroup: vi.fn().mockResolvedValue(1),
      findGroupById: vi.fn().mockResolvedValue({ id: 1, name: 'New' }),
    })
    handler = (await import('../../server/api/vault/groups/index.post')).default
  })

  it('should reject empty name', async () => {
    mockBody({ name: '  ' })
    await expectError(handler, 400, '分组名称不能为空')
  })

  it('should reject name > 50 chars', async () => {
    mockBody({ name: 'x'.repeat(51) })
    await expectError(handler, 400, '分组名称不能超过50个字符')
  })

  it('should create group on success', async () => {
    mockBody({ name: 'New Group' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(setResponseStatus).toHaveBeenCalledWith(event, 201)
  })
})

// ══════════════════════════════════════════════════════════════
// Finance — Records List + Delete + Categories List + Statistics
// ══════════════════════════════════════════════════════════════

describe('Finance — Records List', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceRecordModel', {
      findByUser: vi.fn().mockResolvedValue({ records: [], total: 0 }),
    })
    handler = (await import('../../server/api/finance/records/index.get')).default
  })

  it('should return paginated response', async () => {
    mockQuery({})
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.pagination).toBeDefined()
    expect(result.pagination.limit).toBe(50) // default 50 for finance
  })

  it('should clamp limit to max 200', async () => {
    mockQuery({ limit: '500' })
    await handler(event)
    const call = vi.mocked(FinanceRecordModel.findByUser).mock.calls[0]
    expect(call[1].limit).toBe(200)
  })
})

describe('Finance — Record Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceRecordModel', { delete: vi.fn().mockResolvedValue(true) })
    handler = (await import('../../server/api/finance/records/[id].delete')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的记录ID')
  })

  it('should reject zero ID', async () => {
    mockParam('0')
    await expectError(handler, 400, '无效的记录ID')
  })

  it('should return 404 if not found', async () => {
    mockParam('1')
    vi.mocked(FinanceRecordModel.delete).mockResolvedValue(false)
    await expectError(handler, 404, '记录不存在')
  })

  it('should delete record on success', async () => {
    mockParam('1')
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已删除')
  })
})

describe('Finance — Categories List', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceCategoryModel', {
      findByUser: vi.fn().mockResolvedValue([{ id: 1, name: 'Food' }]),
    })
    handler = (await import('../../server/api/finance/categories/index.get')).default
  })

  it('should return categories', async () => {
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })
})

describe('Finance — Statistics', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceRecordModel', {
      getStatistics: vi.fn().mockResolvedValue({
        total_income: 1000, total_expense: 500, balance: 500, by_category: []
      }),
    })
    handler = (await import('../../server/api/finance/statistics.get')).default
  })

  it('should reject invalid date format', async () => {
    mockQuery({ start_date: 'not-a-date' })
    await expectError(handler, 400, '日期格式必须为 YYYY-MM-DD')
  })

  it('should reject invalid end_date format', async () => {
    mockQuery({ start_date: '2025-01-01', end_date: '01/31/2025' })
    await expectError(handler, 400, '日期格式必须为 YYYY-MM-DD')
  })

  it('should return statistics with valid dates', async () => {
    mockQuery({ start_date: '2025-01-01', end_date: '2025-01-31' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.balance).toBe(500)
  })

  it('should default to current month when no dates provided', async () => {
    mockQuery({})
    const result = await handler(event)
    expect(result.success).toBe(true)
    // Just ensuring it doesn't throw — defaults are computed dynamically
    expect(FinanceRecordModel.getStatistics).toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════
// Important Dates — List + Delete
// ══════════════════════════════════════════════════════════════

describe('Important Dates — List with days_until enrichment', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ImportantDateModel', {
      findByUser: vi.fn().mockResolvedValue([]),
    })
    handler = (await import('../../server/api/important-dates/index.get')).default
  })

  it('should return enriched dates with days_until', async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const dateStr = futureDate.toISOString().split('T')[0]
    vi.mocked(ImportantDateModel.findByUser).mockResolvedValue([
      { id: 1, title: 'Birthday', date: dateStr, repeat_type: 'none' }
    ])
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data[0].days_until).toBeGreaterThanOrEqual(9) // ~10 days
    expect(result.data[0].days_until).toBeLessThanOrEqual(11)
  })

  it('should sort by days_until ascending', async () => {
    const d1 = new Date(); d1.setDate(d1.getDate() + 30)
    const d2 = new Date(); d2.setDate(d2.getDate() + 5)
    vi.mocked(ImportantDateModel.findByUser).mockResolvedValue([
      { id: 1, title: 'Far', date: d1.toISOString().split('T')[0], repeat_type: 'none' },
      { id: 2, title: 'Near', date: d2.toISOString().split('T')[0], repeat_type: 'none' },
    ])
    const result = await handler(event)
    expect(result.data[0].title).toBe('Near')
    expect(result.data[1].title).toBe('Far')
  })
})

describe('Important Dates — Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ImportantDateModel', { delete: vi.fn().mockResolvedValue(true) })
    handler = (await import('../../server/api/important-dates/[id].delete')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的ID')
  })

  it('should reject zero ID', async () => {
    mockParam('0')
    await expectError(handler, 400, '无效的ID')
  })

  it('should return 404 if not found', async () => {
    mockParam('1')
    vi.mocked(ImportantDateModel.delete).mockResolvedValue(false)
    await expectError(handler, 404, '重要日期不存在')
  })

  it('should delete on success', async () => {
    mockParam('1')
    const result = await handler(event)
    expect(result.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════
// Period — Predict + Delete
// ══════════════════════════════════════════════════════════════

describe('Period — Predict', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('PeriodModel', { predict: vi.fn().mockResolvedValue(null) })
    handler = (await import('../../server/api/period/predict.get')).default
  })

  it('should return null data with message when no prediction available', async () => {
    mockQuery({})
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data).toBeNull()
    expect(result.message).toContain('暂无足够数据')
  })

  it('should return prediction data when available', async () => {
    vi.mocked(PeriodModel.predict).mockResolvedValue({
      next_period_start: '2025-03-01',
      average_cycle_length: 28,
    })
    mockQuery({ person_name: 'Alice' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.next_period_start).toBe('2025-03-01')
    expect(PeriodModel.predict).toHaveBeenCalledWith(1, 'Alice')
  })
})

describe('Period — Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('PeriodModel', { delete: vi.fn().mockResolvedValue(true) })
    handler = (await import('../../server/api/period/[id].delete')).default
  })

  it('should reject NaN ID', async () => {
    mockParam('abc')
    await expectError(handler, 400, 'ID 无效')
  })

  it('should return 404 if not found', async () => {
    mockParam('1')
    vi.mocked(PeriodModel.delete).mockResolvedValue(false)
    await expectError(handler, 404, '经期记录不存在')
  })

  it('should delete on success', async () => {
    mockParam('1')
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已删除')
  })
})

// ══════════════════════════════════════════════════════════════
// Categories — List + Delete
// ══════════════════════════════════════════════════════════════

describe('Categories — List', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('CategoryModel', {
      findByUser: vi.fn().mockResolvedValue([{ id: 1, name: 'Work' }]),
    })
    handler = (await import('../../server/api/categories/index.get')).default
  })

  it('should return categories', async () => {
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })
})

describe('Categories — Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('CategoryModel', { delete: vi.fn().mockResolvedValue(true) })
    handler = (await import('../../server/api/categories/[id].delete')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的分类ID')
  })

  it('should reject zero ID', async () => {
    mockParam('0')
    await expectError(handler, 400, '无效的分类ID')
  })

  it('should return 404 if not found', async () => {
    mockParam('1')
    vi.mocked(CategoryModel.delete).mockResolvedValue(false)
    await expectError(handler, 404, '分类不存在')
  })

  it('should delete on success', async () => {
    mockParam('1')
    const result = await handler(event)
    expect(result.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════
// Tags — List + Delete
// ══════════════════════════════════════════════════════════════

describe('Tags — List', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TagModel', {
      findByUser: vi.fn().mockResolvedValue([{ id: 1, name: 'work' }]),
    })
    handler = (await import('../../server/api/tags/index.get')).default
  })

  it('should return tags', async () => {
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })
})

describe('Tags — Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TagModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, name: 'tag' }),
      delete: vi.fn(),
    })
    handler = (await import('../../server/api/tags/[id].delete')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的标签ID')
  })

  it('should return 404 if not found', async () => {
    mockParam('1')
    vi.mocked(TagModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, '标签不存在')
  })

  it('should delete on success', async () => {
    mockParam('1')
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已删除')
  })
})

// ══════════════════════════════════════════════════════════════
// Health Check
// ══════════════════════════════════════════════════════════════

describe('Health Check', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('getDb', () => ({ query: vi.fn().mockResolvedValue([[]]) }))
    handler = (await import('../../server/api/health.get')).default
  })

  it('should return healthy when DB is reachable', async () => {
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.status).toBe('healthy')
    expect(result.timestamp).toBeDefined()
  })

  it('should return 503 when DB is unreachable', async () => {
    vi.stubGlobal('getDb', () => ({ query: vi.fn().mockRejectedValue(new Error('Connection refused')) }))
    // No re-import needed — handler reads getDb global at runtime
    await expectError(handler, 503, 'Database connection failed')
  })
})
