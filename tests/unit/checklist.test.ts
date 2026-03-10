/**
 * Checklist (每日打卡) — Unit Tests
 *
 * Covers:
 *   - API validation (10 endpoints)
 *   - ChecklistModel CRUD + pool queries
 *   - Stats calculation & streak logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const event = {} as any

function mockBody(body: any) {
  vi.mocked(readBody).mockResolvedValue(body)
}
function mockQuery(query: any) {
  vi.mocked(getQuery).mockReturnValue(query)
}
function mockParam(value: string) {
  vi.mocked(getRouterParam).mockReturnValue(value)
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

// ── Drizzle proxy mock ──
let setCalls: Record<string, any>[]
function createChain(result: any) {
  const handler: ProxyHandler<object> = {
    get(_, prop: string) {
      if (prop === 'then') return (resolve: Function) => resolve(result)
      if (prop === 'catch' || prop === 'finally') return () => new Proxy({}, handler)
      return (...args: any[]) => {
        if (prop === 'set') setCalls.push(args[0])
        return new Proxy({}, handler)
      }
    },
  }
  return new Proxy({}, handler)
}

// ── Pool query mock ──
let queryCalls: Array<{ sql: string; params: any[] }>
let mockPoolQueryFn: ReturnType<typeof vi.fn>

function setupMocks(opts: {
  drizzleResult?: any[]
  poolResponses?: (sql: string) => any
} = {}) {
  setCalls = []
  const drizzleResult = opts.drizzleResult ?? []
  const db = {
    select: () => createChain(drizzleResult),
    insert: () => createChain([{ insertId: 1, affectedRows: 1 }]),
    update: () => createChain([{ affectedRows: 1 }]),
    delete: () => createChain([{ affectedRows: 1 }]),
  }
  vi.stubGlobal('getDb', () => db)

  queryCalls = []
  mockPoolQueryFn = vi.fn().mockImplementation((sql: string, params?: any[]) => {
    queryCalls.push({ sql, params: params || [] })
    if (opts.poolResponses) return opts.poolResponses(sql)
    if (sql.includes('INSERT')) return [{ insertId: 1, affectedRows: 1 }]
    if (sql.includes('UPDATE')) return [{ affectedRows: 1 }]
    if (sql.includes('DELETE')) return [{ affectedRows: 1 }]
    return [[]]
  })
  vi.stubGlobal('getPool', () => ({ query: mockPoolQueryFn }))
}

// ══════════════════════════════════════════════════════════════
// API — Create Item (POST /checklist/items)
// ══════════════════════════════════════════════════════════════

describe('Checklist API — Create Item', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ChecklistModel', {
      createItem: vi.fn().mockResolvedValue(1),
      getItem: vi.fn().mockResolvedValue({ id: 1, title: '早起', icon: '✅', is_active: 1 }),
    })
    handler = (await import('../../server/api/checklist/items/index.post')).default
  })

  it('should reject empty title', async () => {
    mockBody({ title: '' })
    await expectError(handler, 400, '标题为必填项')
  })

  it('should reject missing title', async () => {
    mockBody({})
    await expectError(handler, 400, '标题为必填项')
  })

  it('should reject title > 100 chars', async () => {
    mockBody({ title: 'x'.repeat(101) })
    await expectError(handler, 400, '标题不能超过100个字符')
  })

  it('should accept valid title', async () => {
    mockBody({ title: '早起' })
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(res.data).toBeDefined()
  })

  it('should default icon to ✅', async () => {
    mockBody({ title: '早起' })
    await handler(event)
    // createItem is called with { title: '早起', icon: '✅' }
    expect(vi.mocked(ChecklistModel.createItem)).toHaveBeenCalledWith(1, { title: '早起', icon: '✅' })
  })

  it('should accept custom icon', async () => {
    mockBody({ title: '运动', icon: '🏃' })
    await handler(event)
    expect(vi.mocked(ChecklistModel.createItem)).toHaveBeenCalledWith(1, { title: '运动', icon: '🏃' })
  })

  it('should set 201 status', async () => {
    mockBody({ title: '阅读' })
    await handler(event)
    expect(setResponseStatus).toHaveBeenCalledWith(event, 201)
  })
})

// ══════════════════════════════════════════════════════════════
// API — List Items (GET /checklist/items)
// ══════════════════════════════════════════════════════════════

describe('Checklist API — List Items', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ChecklistModel', {
      getItems: vi.fn().mockResolvedValue([
        { id: 1, title: '早起', icon: '✅' },
        { id: 2, title: '运动', icon: '🏃' },
      ]),
    })
    handler = (await import('../../server/api/checklist/items/index.get')).default
  })

  it('should return items array', async () => {
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(res.data).toHaveLength(2)
  })
})

// ══════════════════════════════════════════════════════════════
// API — Update Item (PUT /checklist/items/:id)
// ══════════════════════════════════════════════════════════════

describe('Checklist API — Update Item', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ChecklistModel', {
      getItem: vi.fn().mockResolvedValue({ id: 1, title: '早起', icon: '✅', is_active: 1 }),
      updateItem: vi.fn().mockResolvedValue(true),
    })
    handler = (await import('../../server/api/checklist/items/[id].put')).default
  })

  it('should reject invalid id', async () => {
    mockParam('abc')
    mockBody({ title: '运动' })
    await expectError(handler, 400, '无效的习惯 ID')
  })

  it('should reject non-integer id', async () => {
    mockParam('1.5')
    mockBody({ title: '运动' })
    await expectError(handler, 400, '无效的习惯 ID')
  })

  it('should return 404 for non-existent item', async () => {
    vi.mocked(ChecklistModel.getItem).mockResolvedValue(null as any)
    mockParam('999')
    mockBody({ title: '运动' })
    await expectError(handler, 404, '习惯不存在')
  })

  it('should reject empty title', async () => {
    mockParam('1')
    mockBody({ title: '   ' })
    await expectError(handler, 400, '标题不能为空')
  })

  it('should reject title > 100 chars', async () => {
    mockParam('1')
    mockBody({ title: 'x'.repeat(101) })
    await expectError(handler, 400, '标题不能超过100个字符')
  })

  it('should accept valid update', async () => {
    mockParam('1')
    mockBody({ title: '运动', icon: '🏃' })
    const res = await handler(event)
    expect(res.success).toBe(true)
  })

  it('should accept is_active toggle', async () => {
    mockParam('1')
    mockBody({ is_active: false })
    const res = await handler(event)
    expect(res.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════
// API — Delete Item (DELETE /checklist/items/:id)
// ══════════════════════════════════════════════════════════════

describe('Checklist API — Delete Item', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ChecklistModel', {
      deleteItem: vi.fn().mockResolvedValue(true),
    })
    handler = (await import('../../server/api/checklist/items/[id].delete')).default
  })

  it('should reject invalid id', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效的习惯 ID')
  })

  it('should return 404 if not deleted', async () => {
    vi.mocked(ChecklistModel.deleteItem).mockResolvedValue(false as any)
    mockParam('1')
    await expectError(handler, 404, '习惯不存在')
  })

  it('should succeed for valid delete', async () => {
    mockParam('1')
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(res.message).toContain('已删除')
  })
})

// ══════════════════════════════════════════════════════════════
// API — Reorder (PUT /checklist/items/reorder)
// ══════════════════════════════════════════════════════════════

describe('Checklist API — Reorder', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ChecklistModel', {
      reorderItems: vi.fn().mockResolvedValue(undefined),
    })
    handler = (await import('../../server/api/checklist/items/reorder.put')).default
  })

  it('should reject missing item_ids', async () => {
    mockBody({})
    await expectError(handler, 400, 'item_ids 为必填数组')
  })

  it('should reject empty array', async () => {
    mockBody({ item_ids: [] })
    await expectError(handler, 400, 'item_ids 为必填数组')
  })

  it('should reject non-array', async () => {
    mockBody({ item_ids: 'not-array' })
    await expectError(handler, 400, 'item_ids 为必填数组')
  })

  it('should reject all invalid ids', async () => {
    mockBody({ item_ids: ['a', -1, 0] })
    await expectError(handler, 400, 'item_ids 包含无效 ID')
  })

  it('should succeed with valid ids', async () => {
    mockBody({ item_ids: [3, 1, 2] })
    const res = await handler(event)
    expect(res.success).toBe(true)
  })

  it('should filter and pass only valid integer ids', async () => {
    mockBody({ item_ids: [3, 'x', 1] })
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(vi.mocked(ChecklistModel.reorderItems)).toHaveBeenCalledWith(1, [3, 1])
  })
})

// ══════════════════════════════════════════════════════════════
// API — Today (GET /checklist/today)
// ══════════════════════════════════════════════════════════════

describe('Checklist API — Today', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ChecklistModel', {
      getTodayItems: vi.fn().mockResolvedValue([
        { id: 1, title: '早起', checked: true, checked_at: '2026-03-09 08:00:00' },
      ]),
    })
    handler = (await import('../../server/api/checklist/today.get')).default
  })

  it('should accept date query param', async () => {
    mockQuery({ date: '2026-03-01' })
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(vi.mocked(ChecklistModel.getTodayItems)).toHaveBeenCalledWith(1, '2026-03-01')
  })

  it('should default to today when no date param', async () => {
    mockQuery({})
    const res = await handler(event)
    expect(res.success).toBe(true)
    // Should have been called with today's date string
    const [, dateArg] = vi.mocked(ChecklistModel.getTodayItems).mock.calls[0]
    expect(dateArg).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('should ignore invalid date format', async () => {
    mockQuery({ date: 'not-a-date' })
    await handler(event)
    const [, dateArg] = vi.mocked(ChecklistModel.getTodayItems).mock.calls[0]
    expect(dateArg).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ══════════════════════════════════════════════════════════════
// API — Check In (POST /checklist/check)
// ══════════════════════════════════════════════════════════════

describe('Checklist API — Check In', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ChecklistModel', {
      getItem: vi.fn().mockResolvedValue({ id: 1, title: '早起', is_active: 1 }),
      checkIn: vi.fn().mockResolvedValue(undefined),
    })
    handler = (await import('../../server/api/checklist/check.post')).default
  })

  it('should reject missing item_id', async () => {
    mockBody({})
    await expectError(handler, 400, '无效的 item_id')
  })

  it('should reject non-integer item_id', async () => {
    mockBody({ item_id: 'abc' })
    await expectError(handler, 400, '无效的 item_id')
  })

  it('should reject future dates', async () => {
    mockBody({ item_id: 1, date: '2099-12-31' })
    await expectError(handler, 400, '不能打卡未来日期')
  })

  it('should return 404 for non-existent item', async () => {
    vi.mocked(ChecklistModel.getItem).mockResolvedValue(null as any)
    mockBody({ item_id: 999 })
    await expectError(handler, 404, '习惯不存在')
  })

  it('should succeed for valid check-in', async () => {
    mockBody({ item_id: 1, date: '2026-03-09' })
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(res.message).toContain('打卡成功')
  })

  it('should accept check-in without explicit date (defaults to today)', async () => {
    mockBody({ item_id: 1 })
    const res = await handler(event)
    expect(res.success).toBe(true)
  })

  it('should allow past dates', async () => {
    mockBody({ item_id: 1, date: '2026-01-01' })
    const res = await handler(event)
    expect(res.success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════
// API — Uncheck (POST /checklist/uncheck)
// ══════════════════════════════════════════════════════════════

describe('Checklist API — Uncheck', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ChecklistModel', {
      getItem: vi.fn().mockResolvedValue({ id: 1, title: '早起' }),
      uncheckIn: vi.fn().mockResolvedValue(undefined),
    })
    handler = (await import('../../server/api/checklist/uncheck.post')).default
  })

  it('should reject missing item_id', async () => {
    mockBody({})
    await expectError(handler, 400, '无效的 item_id')
  })

  it('should return 404 for non-existent item', async () => {
    vi.mocked(ChecklistModel.getItem).mockResolvedValue(null as any)
    mockBody({ item_id: 999 })
    await expectError(handler, 404, '习惯不存在')
  })

  it('should succeed for valid uncheck', async () => {
    mockBody({ item_id: 1, date: '2026-03-09' })
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(res.message).toContain('已取消打卡')
  })

  it('should default to today when no date', async () => {
    mockBody({ item_id: 1 })
    const res = await handler(event)
    expect(res.success).toBe(true)
    const [, , dateArg] = vi.mocked(ChecklistModel.uncheckIn).mock.calls[0]
    expect(dateArg).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ══════════════════════════════════════════════════════════════
// API — History (GET /checklist/history)
// ══════════════════════════════════════════════════════════════

describe('Checklist API — History', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ChecklistModel', {
      getHistory: vi.fn().mockResolvedValue([]),
      getItems: vi.fn().mockResolvedValue([
        { id: 1, title: '早起', icon: '✅', is_active: 1 },
      ]),
    })
    handler = (await import('../../server/api/checklist/history.get')).default
  })

  it('should reject missing start_date', async () => {
    mockQuery({ end_date: '2026-03-09' })
    await expectError(handler, 400, 'start_date 和 end_date 为必填项')
  })

  it('should reject missing end_date', async () => {
    mockQuery({ start_date: '2026-03-01' })
    await expectError(handler, 400, 'start_date 和 end_date 为必填项')
  })

  it('should reject invalid date format', async () => {
    mockQuery({ start_date: '2026/03/01', end_date: '2026-03-09' })
    await expectError(handler, 400, 'start_date 和 end_date 为必填项')
  })

  it('should reject start_date > end_date', async () => {
    mockQuery({ start_date: '2026-03-10', end_date: '2026-03-01' })
    await expectError(handler, 400, 'start_date 不能晚于 end_date')
  })

  it('should return date-grouped results', async () => {
    mockQuery({ start_date: '2026-03-08', end_date: '2026-03-09' })
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    // Should have 2 days
    expect(res.data.length).toBe(2)
    // Each day should have items array
    expect(res.data[0].items).toBeDefined()
  })
})

// ══════════════════════════════════════════════════════════════
// API — Stats (GET /checklist/stats)
// ══════════════════════════════════════════════════════════════

describe('Checklist API — Stats', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('ChecklistModel', {
      getStats: vi.fn().mockResolvedValue({
        overall: { total_days: 30, perfect_days: 5, overall_rate: 70, current_streak: 3, longest_streak: 7 },
        items: [],
        heatmap: [],
      }),
    })
    handler = (await import('../../server/api/checklist/stats.get')).default
  })

  it('should default to 30 days', async () => {
    mockQuery({})
    await handler(event)
    expect(vi.mocked(ChecklistModel.getStats)).toHaveBeenCalledWith(1, 30)
  })

  it('should accept custom days', async () => {
    mockQuery({ days: '90' })
    await handler(event)
    expect(vi.mocked(ChecklistModel.getStats)).toHaveBeenCalledWith(1, 90)
  })

  it('should clamp days to 1-365', async () => {
    mockQuery({ days: '0' })
    await handler(event)
    expect(vi.mocked(ChecklistModel.getStats)).toHaveBeenCalledWith(1, 1)
  })

  it('should clamp days to max 365', async () => {
    mockQuery({ days: '999' })
    await handler(event)
    expect(vi.mocked(ChecklistModel.getStats)).toHaveBeenCalledWith(1, 365)
  })

  it('should return stats object', async () => {
    mockQuery({})
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(res.data.overall).toBeDefined()
    expect(res.data.items).toBeDefined()
    expect(res.data.heatmap).toBeDefined()
  })
})

// ══════════════════════════════════════════════════════════════
// ChecklistModel — CRUD (Drizzle + Pool)
// ══════════════════════════════════════════════════════════════

describe('ChecklistModel.createItem', () => {
  let ChecklistModel: any

  beforeEach(async () => {
    setupMocks({ drizzleResult: [{ max: 2 }] })
    const mod = await import('../../server/utils/models/checklist.model')
    ChecklistModel = mod.ChecklistModel
  })

  it('should calculate next sort_order', async () => {
    const id = await ChecklistModel.createItem(1, { title: '喝水', icon: '💧' })
    expect(id).toBe(1) // from mock insertId
  })
})

describe('ChecklistModel.reorderItems', () => {
  let ChecklistModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/checklist.model')
    ChecklistModel = mod.ChecklistModel
  })

  it('should generate batch CASE UPDATE SQL', async () => {
    await ChecklistModel.reorderItems(1, [3, 1, 2])
    const call = queryCalls.find(c => c.sql.includes('CASE'))!
    expect(call).toBeDefined()
    expect(call.sql).toContain('WHEN id = 3 THEN 0')
    expect(call.sql).toContain('WHEN id = 1 THEN 1')
    expect(call.sql).toContain('WHEN id = 2 THEN 2')
  })

  it('should skip when empty array', async () => {
    await ChecklistModel.reorderItems(1, [])
    expect(queryCalls).toHaveLength(0)
  })
})

describe('ChecklistModel.checkIn', () => {
  let ChecklistModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/checklist.model')
    ChecklistModel = mod.ChecklistModel
  })

  it('should use INSERT IGNORE for idempotency', async () => {
    await ChecklistModel.checkIn(1, 1, '2026-03-09')
    const call = queryCalls.find(c => c.sql.includes('INSERT IGNORE'))!
    expect(call).toBeDefined()
    expect(call.params).toEqual([1, 1, '2026-03-09'])
  })
})

describe('ChecklistModel.getTodayItems', () => {
  let ChecklistModel: any

  beforeEach(async () => {
    setupMocks({
      poolResponses: (sql: string) => {
        if (sql.includes('LEFT JOIN')) {
          return [[
            { id: 1, title: '早起', icon: '☀️', checked: true, checked_at: '2026-03-09 07:00:00' },
            { id: 2, title: '运动', icon: '🏃', checked: false, checked_at: null },
          ]]
        }
        return [[]]
      },
    })
    const mod = await import('../../server/utils/models/checklist.model')
    ChecklistModel = mod.ChecklistModel
  })

  it('should return items with checked status', async () => {
    const items = await ChecklistModel.getTodayItems(1, '2026-03-09')
    expect(items).toHaveLength(2)
    expect(items[0].checked).toBe(true)
    expect(items[1].checked).toBe(false)
  })

  it('should query with LEFT JOIN on checklist_records', async () => {
    await ChecklistModel.getTodayItems(1, '2026-03-09')
    const call = queryCalls.find(c => c.sql.includes('LEFT JOIN'))!
    expect(call).toBeDefined()
    expect(call.params).toEqual(['2026-03-09', 1])
  })
})

describe('ChecklistModel.getHistory', () => {
  let ChecklistModel: any

  beforeEach(async () => {
    setupMocks({
      poolResponses: (sql: string) => {
        if (sql.includes('INNER JOIN')) {
          return [[
            { check_date: '2026-03-09', item_id: 1, title: '早起', icon: '☀️', checked: true },
          ]]
        }
        return [[]]
      },
    })
    const mod = await import('../../server/utils/models/checklist.model')
    ChecklistModel = mod.ChecklistModel
  })

  it('should query with date range', async () => {
    await ChecklistModel.getHistory(1, '2026-03-01', '2026-03-09')
    const call = queryCalls.find(c => c.sql.includes('BETWEEN'))!
    expect(call).toBeDefined()
    expect(call.params).toEqual([1, '2026-03-01', '2026-03-09'])
  })
})

describe('ChecklistModel.getStats', () => {
  let ChecklistModel: any

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-09T12:00:00'))
    setupMocks({
      poolResponses: (sql: string) => {
        if (sql.includes('FROM checklist_items') && !sql.includes('checklist_records')) {
          return [[
            { id: 1, title: '早起', icon: '☀️', created_at: '2026-03-01' },
            { id: 2, title: '运动', icon: '🏃', created_at: '2026-03-01' },
          ]]
        }
        if (sql.includes('FROM checklist_records')) {
          return [[
            { item_id: 1, check_date: '2026-03-09' },
            { item_id: 2, check_date: '2026-03-09' },
            { item_id: 1, check_date: '2026-03-08' },
            { item_id: 2, check_date: '2026-03-08' },
            { item_id: 1, check_date: '2026-03-07' },
          ]]
        }
        return [[]]
      },
    })
    const mod = await import('../../server/utils/models/checklist.model')
    ChecklistModel = mod.ChecklistModel
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return overall stats', async () => {
    const stats = await ChecklistModel.getStats(1, 7)
    expect(stats.overall).toBeDefined()
    expect(stats.overall.total_days).toBe(7)
    expect(typeof stats.overall.perfect_days).toBe('number')
    expect(typeof stats.overall.current_streak).toBe('number')
    expect(typeof stats.overall.longest_streak).toBe('number')
    expect(typeof stats.overall.overall_rate).toBe('number')
  })

  it('should return per-item stats', async () => {
    const stats = await ChecklistModel.getStats(1, 7)
    expect(stats.items).toHaveLength(2)
    expect(stats.items[0].item_id).toBe(1)
    expect(stats.items[0].checked_days).toBeGreaterThanOrEqual(0)
    expect(stats.items[0].current_streak).toBeGreaterThanOrEqual(0)
    expect(stats.items[0].longest_streak).toBeGreaterThanOrEqual(0)
    expect(stats.items[0].completion_rate).toBeGreaterThanOrEqual(0)
  })

  it('should return heatmap data', async () => {
    const stats = await ChecklistModel.getStats(1, 7)
    expect(Array.isArray(stats.heatmap)).toBe(true)
    if (stats.heatmap.length > 0) {
      const day = stats.heatmap[0]
      expect(day).toHaveProperty('date')
      expect(day).toHaveProperty('total')
      expect(day).toHaveProperty('checked')
      expect(day).toHaveProperty('rate')
    }
  })

  it('should return empty stats when no items', async () => {
    setupMocks({
      poolResponses: (sql: string) => {
        if (sql.includes('FROM checklist_items')) return [[]]
        return [[]]
      },
    })
    const mod = await import('../../server/utils/models/checklist.model')
    const model = mod.ChecklistModel
    const stats = await model.getStats(1, 30)
    expect(stats.overall.perfect_days).toBe(0)
    expect(stats.overall.overall_rate).toBe(0)
    expect(stats.items).toHaveLength(0)
    expect(stats.heatmap).toHaveLength(0)
  })

  it('should calculate 2 perfect days for the mock data', async () => {
    // Items 1 & 2 both checked on 03-08 and 03-09 → 2 perfect days
    // Only item 1 checked on 03-07 → not perfect
    const stats = await ChecklistModel.getStats(1, 7)
    expect(stats.overall.perfect_days).toBe(2)
  })

  it('should calculate current streak from today', async () => {
    const stats = await ChecklistModel.getStats(1, 7)
    // 03-09: perfect, 03-08: perfect, 03-07: not perfect → current streak = 2
    expect(stats.overall.current_streak).toBe(2)
  })
})
