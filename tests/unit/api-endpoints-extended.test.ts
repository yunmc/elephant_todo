/**
 * API Endpoints — Extended Regression Tests (Phase 2)
 *
 * Tests ALL remaining API endpoints not covered by api-validation.test.ts.
 * Focuses on: route-param validation, 404 paths, happy paths, edge cases.
 *
 * Same pattern: import real handlers with mocked Nitro globals, assert
 * statusCode and message.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const event = {} as any

function mockBody(body: any) {
  vi.mocked(readBody).mockResolvedValue(body)
}
function mockParam(value: string) {
  vi.mocked(getRouterParam).mockReturnValue(value)
}
function mockParams(params: Record<string, string>) {
  vi.mocked(getRouterParam).mockImplementation((_event: any, name: string) => params[name])
}
function mockQuery(query: Record<string, any>) {
  vi.mocked(getQuery).mockReturnValue(query)
}
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
// AUTH — Forgot Password
// ══════════════════════════════════════════════════════════════

describe('Auth — Forgot Password', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('UserModel', {
      findByEmail: vi.fn().mockResolvedValue(null),
      invalidateResetTokens: vi.fn(),
      createResetToken: vi.fn(),
    })
    vi.mocked(sendResetPasswordEmail).mockResolvedValue(undefined)
    handler = (await import('../../server/api/auth/forgot-password.post')).default
  })

  it('should reject missing email', async () => {
    mockBody({})
    await expectError(handler, 400, '请输入邮箱地址')
  })

  it('should reject empty email', async () => {
    mockBody({ email: '' })
    await expectError(handler, 400, '请输入邮箱地址')
  })

  it('should return success even if user not found (anti-enumeration)', async () => {
    vi.mocked(UserModel.findByEmail).mockResolvedValue(null)
    mockBody({ email: 'unknown@test.com' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('如果该邮箱已注册')
  })

  it('should create reset token when user exists', async () => {
    vi.mocked(UserModel.findByEmail).mockResolvedValue({ id: 1, email: 'test@test.com' })
    mockBody({ email: 'test@test.com' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(UserModel.invalidateResetTokens).toHaveBeenCalledWith(1)
    expect(UserModel.createResetToken).toHaveBeenCalled()
    expect(sendResetPasswordEmail).toHaveBeenCalledWith('test@test.com', expect.any(String))
  })

  it('should still return success if sendResetPasswordEmail throws', async () => {
    vi.mocked(UserModel.findByEmail).mockResolvedValue({ id: 1, email: 'test@test.com' })
    vi.mocked(sendResetPasswordEmail).mockRejectedValue(new Error('SMTP fail'))
    mockBody({ email: 'test@test.com' })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════
// AUTH — Reset Password
// ══════════════════════════════════════════════════════════════

describe('Auth — Reset Password', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('UserModel', {
      findResetToken: vi.fn().mockResolvedValue(null),
      updatePassword: vi.fn(),
      markResetTokenUsed: vi.fn(),
    })
    handler = (await import('../../server/api/auth/reset-password.post')).default
  })

  it('should reject missing token', async () => {
    mockBody({ password: '123456' })
    await expectError(handler, 400, '令牌和新密码为必填项')
  })

  it('should reject missing password', async () => {
    mockBody({ token: 'some-token' })
    await expectError(handler, 400, '令牌和新密码为必填项')
  })

  it('should reject empty token and password', async () => {
    mockBody({})
    await expectError(handler, 400, '令牌和新密码为必填项')
  })

  it('should reject password shorter than 6 chars', async () => {
    mockBody({ token: 'some-token', password: '12345' })
    await expectError(handler, 400, '密码长度至少 6 位')
  })

  it('should reject invalid (not found) reset token', async () => {
    vi.mocked(UserModel.findResetToken).mockResolvedValue(null)
    mockBody({ token: 'bad-token', password: '123456' })
    await expectError(handler, 400, '重置令牌无效')
  })

  it('should reject already-used reset token', async () => {
    vi.mocked(UserModel.findResetToken).mockResolvedValue({
      id: 1, user_id: 1, used: true, expires_at: new Date(Date.now() + 3600000),
    })
    mockBody({ token: 'used-token', password: '123456' })
    await expectError(handler, 400, '重置令牌已被使用')
  })

  it('should reject expired reset token', async () => {
    vi.mocked(UserModel.findResetToken).mockResolvedValue({
      id: 1, user_id: 1, used: false, expires_at: new Date(Date.now() - 1000),
    })
    mockBody({ token: 'expired-token', password: '123456' })
    await expectError(handler, 400, '重置令牌已过期')
  })

  it('should reset password with valid token', async () => {
    vi.mocked(UserModel.findResetToken).mockResolvedValue({
      id: 10, user_id: 5, used: false, expires_at: new Date(Date.now() + 3600000),
    })
    mockBody({ token: 'good-token', password: 'newpass123' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('密码已重置')
    expect(UserModel.updatePassword).toHaveBeenCalledWith(5, expect.any(String))
    expect(UserModel.markResetTokenUsed).toHaveBeenCalledWith(10)
  })
})

// ══════════════════════════════════════════════════════════════
// AUTH — Me
// ══════════════════════════════════════════════════════════════

describe('Auth — Me (current user)', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('UserModel', {
      findById: vi.fn().mockResolvedValue(null),
    })
    handler = (await import('../../server/api/auth/me.get')).default
  })

  it('should return 404 if user not found', async () => {
    vi.mocked(UserModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, '用户不存在')
  })

  it('should return user data on success', async () => {
    const user = { id: 1, username: 'alice', email: 'a@b.com', created_at: new Date(), updated_at: new Date() }
    vi.mocked(UserModel.findById).mockResolvedValue(user)
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.username).toBe('alice')
    expect(result.data.email).toBe('a@b.com')
  })
})

// ══════════════════════════════════════════════════════════════
// TODOS — Get by ID
// ══════════════════════════════════════════════════════════════

describe('Todos — Get by ID', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', {
      findById: vi.fn().mockResolvedValue(null),
      getTags: vi.fn().mockResolvedValue([]),
      getIdeasCount: vi.fn().mockResolvedValue(0),
    })
    handler = (await import('../../server/api/todos/[id].get')).default
  })

  it('should return 404 when todo not found', async () => {
    mockParam('1')
    vi.mocked(TodoModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, 'Todo 不存在')
  })

  it('should return todo with tags and ideas_count', async () => {
    mockParam('1')
    const todo = { id: 1, title: 'Test', status: 'pending' }
    vi.mocked(TodoModel.findById).mockResolvedValue(todo)
    vi.mocked(TodoModel.getTags).mockResolvedValue([{ id: 10, name: 'work' }])
    vi.mocked(TodoModel.getIdeasCount).mockResolvedValue(3)
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.title).toBe('Test')
    expect(result.data.tags).toEqual([{ id: 10, name: 'work' }])
    expect(result.data.ideas_count).toBe(3)
  })
})

// ══════════════════════════════════════════════════════════════
// TODOS — Delete
// ══════════════════════════════════════════════════════════════

describe('Todos — Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', {
      delete: vi.fn().mockResolvedValue(false),
    })
    handler = (await import('../../server/api/todos/[id].delete')).default
  })

  it('should return 404 when todo not found', async () => {
    mockParam('999')
    vi.mocked(TodoModel.delete).mockResolvedValue(false)
    await expectError(handler, 404, 'Todo 不存在')
  })

  it('should delete todo successfully', async () => {
    mockParam('1')
    vi.mocked(TodoModel.delete).mockResolvedValue(true)
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已删除')
  })
})

// ══════════════════════════════════════════════════════════════
// TODOS — Toggle Status
// ══════════════════════════════════════════════════════════════

describe('Todos — Toggle Status', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', {
      toggleStatus: vi.fn().mockResolvedValue(null),
    })
    handler = (await import('../../server/api/todos/[id]/toggle.patch')).default
  })

  it('should return 404 when todo not found', async () => {
    mockParam('1')
    vi.mocked(TodoModel.toggleStatus).mockResolvedValue(null)
    await expectError(handler, 404, 'Todo 不存在')
  })

  it('should show "完成" message when toggled to completed', async () => {
    mockParam('1')
    vi.mocked(TodoModel.toggleStatus).mockResolvedValue({ id: 1, status: 'completed' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('完成')
  })

  it('should show "恢复" message when toggled to pending', async () => {
    mockParam('1')
    vi.mocked(TodoModel.toggleStatus).mockResolvedValue({ id: 1, status: 'pending' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('恢复')
  })
})

// ══════════════════════════════════════════════════════════════
// TODOS — Subtasks Create
// ══════════════════════════════════════════════════════════════

describe('Todos — Subtask Create', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', {
      findById: vi.fn().mockResolvedValue({ id: 1 }),
    })
    vi.stubGlobal('SubtaskModel', {
      create: vi.fn().mockResolvedValue(10),
      findById: vi.fn().mockResolvedValue({ id: 10, title: 'Sub' }),
    })
    handler = (await import('../../server/api/todos/[id]/subtasks/index.post')).default
  })

  it('should reject empty title', async () => {
    mockParam('1')
    mockBody({ title: '' })
    await expectError(handler, 400, '子任务标题不能为空')
  })

  it('should reject whitespace-only title', async () => {
    mockParam('1')
    mockBody({ title: '   ' })
    await expectError(handler, 400, '子任务标题不能为空')
  })

  it('should reject missing title', async () => {
    mockParam('1')
    mockBody({})
    await expectError(handler, 400, '子任务标题不能为空')
  })

  it('should return 404 when todo not found', async () => {
    mockParam('1')
    mockBody({ title: 'Sub task' })
    vi.mocked(TodoModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, 'Todo 不存在')
  })

  it('should create subtask on success', async () => {
    mockParam('1')
    mockBody({ title: 'New subtask' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.id).toBe(10)
  })
})

// ══════════════════════════════════════════════════════════════
// TODOS — Subtask Delete
// ══════════════════════════════════════════════════════════════

describe('Todos — Subtask Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', {
      findById: vi.fn().mockResolvedValue({ id: 1 }),
    })
    vi.stubGlobal('SubtaskModel', {
      delete: vi.fn().mockResolvedValue(true),
    })
    handler = (await import('../../server/api/todos/[id]/subtasks/[subtaskId]/index.delete')).default
  })

  it('should return 404 when todo not found', async () => {
    mockParams({ id: '1', subtaskId: '2' })
    vi.mocked(TodoModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, 'Todo 不存在')
  })

  it('should return 404 when subtask not found', async () => {
    mockParams({ id: '1', subtaskId: '2' })
    vi.mocked(SubtaskModel.delete).mockResolvedValue(false)
    await expectError(handler, 404, '子任务不存在')
  })

  it('should delete subtask on success', async () => {
    mockParams({ id: '1', subtaskId: '2' })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════
// TODOS — Subtask Toggle
// ══════════════════════════════════════════════════════════════

describe('Todos — Subtask Toggle', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', {
      findById: vi.fn().mockResolvedValue({ id: 1 }),
    })
    vi.stubGlobal('SubtaskModel', {
      toggleStatus: vi.fn().mockResolvedValue({ id: 2, status: 'completed' }),
    })
    handler = (await import('../../server/api/todos/[id]/subtasks/[subtaskId]/toggle.patch')).default
  })

  it('should return 404 when todo not found', async () => {
    mockParams({ id: '1', subtaskId: '2' })
    vi.mocked(TodoModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, 'Todo 不存在')
  })

  it('should return 404 when subtask not found', async () => {
    mockParams({ id: '1', subtaskId: '2' })
    vi.mocked(SubtaskModel.toggleStatus).mockResolvedValue(null)
    await expectError(handler, 404, '子任务不存在')
  })

  it('should toggle subtask on success', async () => {
    mockParams({ id: '1', subtaskId: '2' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.status).toBe('completed')
  })
})

// ══════════════════════════════════════════════════════════════
// TODOS — Get Ideas for Todo
// ══════════════════════════════════════════════════════════════

describe('Todos — Ideas for Todo', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('TodoModel', {
      findById: vi.fn().mockResolvedValue({ id: 1 }),
    })
    vi.stubGlobal('IdeaModel', {
      findByTodoId: vi.fn().mockResolvedValue([]),
    })
    handler = (await import('../../server/api/todos/[id]/ideas.get')).default
  })

  it('should return 404 when todo not found', async () => {
    mockParam('1')
    vi.mocked(TodoModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, 'Todo 不存在')
  })

  it('should return ideas on success', async () => {
    mockParam('1')
    vi.mocked(IdeaModel.findByTodoId).mockResolvedValue([{ id: 5, content: 'An idea' }])
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].content).toBe('An idea')
  })
})

// ══════════════════════════════════════════════════════════════
// IDEAS — Get by ID
// ══════════════════════════════════════════════════════════════

describe('Ideas — Get by ID', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('IdeaModel', {
      findById: vi.fn().mockResolvedValue(null),
    })
    handler = (await import('../../server/api/ideas/[id].get')).default
  })

  it('should reject non-integer ID (abc)', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的随手记 ID')
  })

  it('should reject float ID', async () => {
    mockParam('1.5')
    await expectError(handler, 400, '无效的随手记 ID')
  })

  it('should reject zero ID', async () => {
    mockParam('0')
    await expectError(handler, 400, '无效的随手记 ID')
  })

  it('should return 404 when idea not found', async () => {
    mockParam('1')
    vi.mocked(IdeaModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, '随手记不存在')
  })

  it('should return idea on success', async () => {
    mockParam('1')
    vi.mocked(IdeaModel.findById).mockResolvedValue({ id: 1, content: 'test idea' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.content).toBe('test idea')
  })
})

// ══════════════════════════════════════════════════════════════
// IDEAS — Delete
// ══════════════════════════════════════════════════════════════

describe('Ideas — Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('IdeaModel', {
      delete: vi.fn().mockResolvedValue(false),
    })
    handler = (await import('../../server/api/ideas/[id].delete')).default
  })

  it('should return 404 when idea not found', async () => {
    mockParam('1')
    vi.mocked(IdeaModel.delete).mockResolvedValue(false)
    await expectError(handler, 404, '随手记不存在')
  })

  it('should delete idea on success', async () => {
    mockParam('1')
    vi.mocked(IdeaModel.delete).mockResolvedValue(true)
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已删除')
  })
})

// ══════════════════════════════════════════════════════════════
// IDEAS — Link to Todo
// ══════════════════════════════════════════════════════════════

describe('Ideas — Link to Todo', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('IdeaModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, content: 'idea' }),
      linkToTodo: vi.fn(),
    })
    vi.stubGlobal('TodoModel', {
      findById: vi.fn().mockResolvedValue({ id: 5, title: 'Todo' }),
    })
    handler = (await import('../../server/api/ideas/[id]/link.post')).default
  })

  it('should reject non-integer idea ID', async () => {
    mockParam('abc')
    mockBody({ todo_id: 1 })
    await expectError(handler, 400, '无效的随手记 ID')
  })

  it('should reject missing todo_id', async () => {
    mockParam('1')
    mockBody({})
    await expectError(handler, 400, '无效的 Todo ID')
  })

  it('should reject non-integer todo_id', async () => {
    mockParam('1')
    mockBody({ todo_id: 'abc' })
    await expectError(handler, 400, '无效的 Todo ID')
  })

  it('should reject zero todo_id', async () => {
    mockParam('1')
    mockBody({ todo_id: 0 })
    await expectError(handler, 400, '无效的 Todo ID')
  })

  it('should reject negative todo_id', async () => {
    mockParam('1')
    mockBody({ todo_id: -1 })
    await expectError(handler, 400, '无效的 Todo ID')
  })

  it('should return 404 when idea not found', async () => {
    mockParam('1')
    mockBody({ todo_id: 5 })
    vi.mocked(IdeaModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, '随手记不存在')
  })

  it('should return 404 when todo not found', async () => {
    mockParam('1')
    mockBody({ todo_id: 5 })
    vi.mocked(TodoModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, 'Todo 不存在')
  })

  it('should link idea to todo on success', async () => {
    mockParam('1')
    mockBody({ todo_id: 5 })
    // After linking, findById returns updated idea
    vi.mocked(IdeaModel.findById)
      .mockResolvedValueOnce({ id: 1, content: 'idea', todo_id: null })
      .mockResolvedValueOnce({ id: 1, content: 'idea', todo_id: 5 })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已关联')
    expect(IdeaModel.linkToTodo).toHaveBeenCalledWith(1, 1, 5)
  })
})

// ══════════════════════════════════════════════════════════════
// IDEAS — Unlink from Todo
// ══════════════════════════════════════════════════════════════

describe('Ideas — Unlink from Todo', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('IdeaModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, content: 'idea', todo_id: 5 }),
      unlink: vi.fn(),
    })
    handler = (await import('../../server/api/ideas/[id]/unlink.post')).default
  })

  it('should reject non-integer idea ID', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的随手记 ID')
  })

  it('should return 404 when idea not found', async () => {
    mockParam('1')
    vi.mocked(IdeaModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, '随手记不存在')
  })

  it('should reject if idea is not linked to any todo', async () => {
    mockParam('1')
    vi.mocked(IdeaModel.findById).mockResolvedValue({ id: 1, content: 'idea', todo_id: null })
    await expectError(handler, 400, '未关联任何待办')
  })

  it('should unlink idea on success', async () => {
    mockParam('1')
    vi.mocked(IdeaModel.findById)
      .mockResolvedValueOnce({ id: 1, content: 'idea', todo_id: 5 })
      .mockResolvedValueOnce({ id: 1, content: 'idea', todo_id: null })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('取消关联')
  })
})

// ══════════════════════════════════════════════════════════════
// IDEAS — Convert to Todo
// ══════════════════════════════════════════════════════════════

describe('Ideas — Convert to Todo', () => {
  let handler: Function

  beforeEach(async () => {
    const mockConn = {
      beginTransaction: vi.fn(),
      query: vi.fn().mockResolvedValue([{ insertId: 99 }]),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    }
    vi.stubGlobal('getDb', () => ({
      query: vi.fn(),
      getConnection: vi.fn().mockResolvedValue(mockConn),
    }))
    vi.stubGlobal('IdeaModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, content: 'My idea content', todo_id: null }),
    })
    vi.stubGlobal('TodoModel', {
      findById: vi.fn().mockResolvedValue({ id: 99, title: 'My idea content', status: 'pending' }),
    })
    handler = (await import('../../server/api/ideas/[id]/convert.post')).default
  })

  it('should reject non-integer idea ID', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的随手记 ID')
  })

  it('should reject zero idea ID', async () => {
    mockParam('0')
    await expectError(handler, 400, '无效的随手记 ID')
  })

  it('should return 404 when idea not found', async () => {
    mockParam('1')
    vi.mocked(IdeaModel.findById).mockResolvedValue(null)
    await expectError(handler, 404, '随手记不存在')
  })

  it('should reject idea already linked to a todo', async () => {
    mockParam('1')
    vi.mocked(IdeaModel.findById).mockResolvedValue({ id: 1, content: 'idea', todo_id: 5 })
    await expectError(handler, 400, '已关联到 Todo，不能转化')
  })

  it('should truncate long content to 200 chars + "..."', async () => {
    mockParam('1')
    const longContent = 'x'.repeat(250)
    vi.mocked(IdeaModel.findById).mockResolvedValue({ id: 1, content: longContent, todo_id: null })
    const result = await handler(event)
    expect(result.success).toBe(true)
    // Verify the conn.query was called with truncated title
    const mockConn = await getDb().getConnection()
    const insertCall = vi.mocked(mockConn.query).mock.calls[0]
    if (insertCall) {
      const title = insertCall[1]?.[1]
      expect(title).toHaveLength(203) // 200 + '...'
      expect(title).toMatch(/\.{3}$/)
    }
  })

  it('should convert idea to todo successfully', async () => {
    mockParam('1')
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('转化为 Todo')
    expect(setResponseStatus).toHaveBeenCalledWith(event, 201)
  })
})

// ══════════════════════════════════════════════════════════════
// MATCH — Smart Suggest
// ══════════════════════════════════════════════════════════════

describe('Match — Smart Suggest', () => {
  let handler: Function

  beforeEach(async () => {
    handler = (await import('../../server/api/match/smart-suggest.post')).default
  })

  it('should reject missing text', async () => {
    mockBody({})
    await expectError(handler, 400, '请提供输入文本')
  })

  it('should reject empty text', async () => {
    mockBody({ text: '' })
    await expectError(handler, 400, '请提供输入文本')
  })

  it('should reject whitespace-only text', async () => {
    mockBody({ text: '   ' })
    await expectError(handler, 400, '请提供输入文本')
  })

  it('should reject text longer than 500 chars', async () => {
    mockBody({ text: 'x'.repeat(501) })
    await expectError(handler, 400, '不能超过 500 字')
  })

  it('should accept text of exactly 500 chars (may fail on template check)', async () => {
    mockBody({ text: 'x'.repeat(500) })
    // In test env, mergedPromptTemplate is empty → 500 error (not 400)
    try {
      await handler(event)
      expect.unreachable('expected error')
    } catch (e: any) {
      // Should NOT be 400 (text is valid), may be 500 (template missing)
      expect(e.statusCode).not.toBe(400)
    }
  })
})

// ══════════════════════════════════════════════════════════════
// VAULT — Salt Get
// ══════════════════════════════════════════════════════════════

describe('Vault — Salt Get', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('UserModel', {
      getVaultSalt: vi.fn().mockResolvedValue('abcdef1234567890abcd'),
    })
    handler = (await import('../../server/api/vault/salt.get')).default
  })

  it('should return salt', async () => {
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.salt).toBe('abcdef1234567890abcd')
  })

  it('should return null salt if not set', async () => {
    vi.mocked(UserModel.getVaultSalt).mockResolvedValue(null)
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.salt).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════
// VAULT — Salt Post
// ══════════════════════════════════════════════════════════════

describe('Vault — Salt Post', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('UserModel', {
      getVaultSalt: vi.fn().mockResolvedValue(null),
      setVaultSalt: vi.fn(),
    })
    handler = (await import('../../server/api/vault/salt.post')).default
  })

  it('should reject missing salt', async () => {
    mockBody({})
    await expectError(handler, 400, '无效的盐值')
  })

  it('should reject non-string salt', async () => {
    mockBody({ salt: 12345 })
    await expectError(handler, 400, '无效的盐值')
  })

  it('should reject salt shorter than 20 chars', async () => {
    mockBody({ salt: 'short' })
    await expectError(handler, 400, '无效的盐值')
  })

  it('should reject salt longer than 50 chars', async () => {
    mockBody({ salt: 'x'.repeat(51) })
    await expectError(handler, 400, '无效的盐值')
  })

  it('should reject duplicate salt (409)', async () => {
    vi.mocked(UserModel.getVaultSalt).mockResolvedValue('existing-salt-value-12345')
    mockBody({ salt: 'a'.repeat(20) })
    await expectError(handler, 409, '盐值已存在')
  })

  it('should accept salt of exactly 20 chars', async () => {
    mockBody({ salt: 'a'.repeat(20) })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(UserModel.setVaultSalt).toHaveBeenCalled()
  })

  it('should accept salt of exactly 50 chars', async () => {
    mockBody({ salt: 'b'.repeat(50) })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════
// VAULT — Entry Get
// ══════════════════════════════════════════════════════════════

describe('Vault — Entry Get by ID', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('VaultModel', {
      findEntryById: vi.fn().mockResolvedValue(null),
    })
    handler = (await import('../../server/api/vault/entries/[id].get')).default
  })

  it('should reject non-integer ID', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的条目ID')
  })

  it('should reject zero ID', async () => {
    mockParam('0')
    await expectError(handler, 400, '无效的条目ID')
  })

  it('should return 404 when entry not found', async () => {
    mockParam('1')
    vi.mocked(VaultModel.findEntryById).mockResolvedValue(null)
    await expectError(handler, 404, '条目不存在')
  })

  it('should return entry on success', async () => {
    mockParam('1')
    vi.mocked(VaultModel.findEntryById).mockResolvedValue({ id: 1, name: 'Secret' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.name).toBe('Secret')
  })
})

// ══════════════════════════════════════════════════════════════
// VAULT — Entry Delete
// ══════════════════════════════════════════════════════════════

describe('Vault — Entry Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('VaultModel', {
      findEntryById: vi.fn().mockResolvedValue({ id: 1 }),
      deleteEntry: vi.fn(),
    })
    handler = (await import('../../server/api/vault/entries/[id].delete')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的条目ID')
  })

  it('should return 404 when entry not found', async () => {
    mockParam('1')
    vi.mocked(VaultModel.findEntryById).mockResolvedValue(null)
    await expectError(handler, 404, '条目不存在')
  })

  it('should delete entry on success', async () => {
    mockParam('1')
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已删除')
  })
})

// ══════════════════════════════════════════════════════════════
// VAULT — Group Update
// ══════════════════════════════════════════════════════════════

describe('Vault — Group Update', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('VaultModel', {
      findGroupById: vi.fn().mockResolvedValue({ id: 1, name: 'Old' }),
      updateGroup: vi.fn(),
    })
    handler = (await import('../../server/api/vault/groups/[id].put')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    mockBody({ name: 'New' })
    await expectError(handler, 400, '无效的分组ID')
  })

  it('should return 404 when group not found', async () => {
    mockParam('1')
    vi.mocked(VaultModel.findGroupById).mockResolvedValue(null)
    mockBody({ name: 'New' })
    await expectError(handler, 404, '分组不存在')
  })

  it('should reject empty name', async () => {
    mockParam('1')
    mockBody({ name: '  ' })
    await expectError(handler, 400, '分组名称不能为空')
  })

  it('should reject name longer than 50 chars', async () => {
    mockParam('1')
    mockBody({ name: 'x'.repeat(51) })
    await expectError(handler, 400, '分组名称不能超过50个字符')
  })

  it('should update group on success', async () => {
    mockParam('1')
    mockBody({ name: 'Updated' })
    vi.mocked(VaultModel.findGroupById)
      .mockResolvedValueOnce({ id: 1, name: 'Old' })
      .mockResolvedValueOnce({ id: 1, name: 'Updated' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(VaultModel.updateGroup).toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════
// VAULT — Group Delete
// ══════════════════════════════════════════════════════════════

describe('Vault — Group Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('VaultModel', {
      findGroupById: vi.fn().mockResolvedValue({ id: 1 }),
      deleteGroup: vi.fn(),
    })
    handler = (await import('../../server/api/vault/groups/[id].delete')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的分组ID')
  })

  it('should return 404 when group not found', async () => {
    mockParam('1')
    vi.mocked(VaultModel.findGroupById).mockResolvedValue(null)
    await expectError(handler, 404, '分组不存在')
  })

  it('should delete group on success', async () => {
    mockParam('1')
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已删除')
  })
})

// ══════════════════════════════════════════════════════════════
// PERIOD — List records
// ══════════════════════════════════════════════════════════════

describe('Period — List records', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('PeriodModel', {
      findByUser: vi.fn().mockResolvedValue([]),
    })
    handler = (await import('../../server/api/period/index.get')).default
  })

  it('should return records without person_name', async () => {
    mockQuery({})
    vi.mocked(PeriodModel.findByUser).mockResolvedValue([{ id: 1, start_date: '2024-01-01' }])
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(PeriodModel.findByUser).toHaveBeenCalledWith(1, undefined)
  })

  it('should pass person_name filter', async () => {
    mockQuery({ person_name: 'Alice' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(PeriodModel.findByUser).toHaveBeenCalledWith(1, 'Alice')
  })
})

// ══════════════════════════════════════════════════════════════
// PERIOD — Person Names
// ══════════════════════════════════════════════════════════════

describe('Period — Person Names', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('PeriodModel', {
      getPersonNames: vi.fn().mockResolvedValue(['Alice', 'Bob']),
    })
    handler = (await import('../../server/api/period/persons.get')).default
  })

  it('should return person names', async () => {
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(['Alice', 'Bob'])
  })
})

// ══════════════════════════════════════════════════════════════
// FINANCE — Category Create
// ══════════════════════════════════════════════════════════════

describe('Finance — Category Create', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceCategoryModel', {
      create: vi.fn().mockResolvedValue(1),
      findById: vi.fn().mockResolvedValue({ id: 1, name: 'Food', type: 'expense' }),
    })
    handler = (await import('../../server/api/finance/categories/index.post')).default
  })

  it('should reject missing name', async () => {
    mockBody({ type: 'expense' })
    await expectError(handler, 400, '分类名称和类型为必填项')
  })

  it('should reject empty name', async () => {
    mockBody({ name: '  ', type: 'expense' })
    await expectError(handler, 400, '分类名称和类型为必填项')
  })

  it('should reject missing type', async () => {
    mockBody({ name: 'Food' })
    await expectError(handler, 400, '分类名称和类型为必填项')
  })

  it('should reject name > 50 chars', async () => {
    mockBody({ name: 'x'.repeat(51), type: 'expense' })
    await expectError(handler, 400, '分类名称不能超过50个字符')
  })

  it('should reject invalid type', async () => {
    mockBody({ name: 'Food', type: 'savings' })
    await expectError(handler, 400, '类型必须为 income 或 expense')
  })

  it('should handle ER_DUP_ENTRY → 409', async () => {
    const err = new Error('Duplicate entry') as any
    err.code = 'ER_DUP_ENTRY'
    vi.mocked(FinanceCategoryModel.create).mockRejectedValue(err)
    mockBody({ name: 'Food', type: 'expense' })
    await expectError(handler, 409, '分类名已存在')
  })

  it('should create category on success', async () => {
    mockBody({ name: 'Food', type: 'expense' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.name).toBe('Food')
    expect(setResponseStatus).toHaveBeenCalledWith(event, 201)
  })

  it('should accept type "income"', async () => {
    mockBody({ name: 'Salary', type: 'income' })
    const result = await handler(event)
    expect(result.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════
// FINANCE — Category Update
// ══════════════════════════════════════════════════════════════

describe('Finance — Category Update', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceCategoryModel', {
      findById: vi.fn().mockResolvedValue({ id: 1, name: 'Food', type: 'expense' }),
      update: vi.fn(),
    })
    handler = (await import('../../server/api/finance/categories/[id].put')).default
  })

  it('should reject invalid ID (non-integer)', async () => {
    mockParam('abc')
    mockBody({ name: 'New' })
    await expectError(handler, 400, '无效的分类ID')
  })

  it('should reject zero ID', async () => {
    mockParam('0')
    mockBody({ name: 'New' })
    await expectError(handler, 400, '无效的分类ID')
  })

  it('should reject negative ID', async () => {
    mockParam('-1')
    mockBody({ name: 'New' })
    await expectError(handler, 400, '无效的分类ID')
  })

  it('should return 404 when category not found', async () => {
    mockParam('1')
    vi.mocked(FinanceCategoryModel.findById).mockResolvedValue(null)
    mockBody({ name: 'New' })
    await expectError(handler, 404, '分类不存在')
  })

  it('should reject empty name', async () => {
    mockParam('1')
    mockBody({ name: '  ' })
    await expectError(handler, 400, '分类名称不能为空')
  })

  it('should reject name > 50 chars', async () => {
    mockParam('1')
    mockBody({ name: 'x'.repeat(51) })
    await expectError(handler, 400, '分类名称不能超过50个字符')
  })

  it('should reject invalid type', async () => {
    mockParam('1')
    mockBody({ type: 'savings' })
    await expectError(handler, 400, '类型必须为 income 或 expense')
  })

  it('should update category on success', async () => {
    mockParam('1')
    mockBody({ name: 'Updated' })
    vi.mocked(FinanceCategoryModel.findById)
      .mockResolvedValueOnce({ id: 1, name: 'Food' })
      .mockResolvedValueOnce({ id: 1, name: 'Updated' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('更新成功')
  })
})

// ══════════════════════════════════════════════════════════════
// FINANCE — Category Delete
// ══════════════════════════════════════════════════════════════

describe('Finance — Category Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceCategoryModel', {
      delete: vi.fn().mockResolvedValue(true),
    })
    handler = (await import('../../server/api/finance/categories/[id].delete')).default
  })

  it('should reject invalid ID', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的分类ID')
  })

  it('should reject zero ID', async () => {
    mockParam('0')
    await expectError(handler, 400, '无效的分类ID')
  })

  it('should return 404 when category not found', async () => {
    mockParam('1')
    vi.mocked(FinanceCategoryModel.delete).mockResolvedValue(false)
    await expectError(handler, 404, '分类不存在')
  })

  it('should delete category on success', async () => {
    mockParam('1')
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已删除')
  })
})
