/**
 * Budget Management — Unit Tests (P3)
 *
 * Covers:
 *   - FinanceBudgetModel CRUD + upsert + progress
 *   - Budget API validation (4 endpoints)
 *   - Premium guards on all budget APIs
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

// ══════════════════════════════════════════════════════════════
// FinanceBudgetModel — CRUD + upsert (Drizzle ORM + getPool)
// ══════════════════════════════════════════════════════════════

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

function setupBudgetMocks(opts: {
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
  const mockPoolQueryFn = vi.fn().mockImplementation((sql: string, params?: any[]) => {
    queryCalls.push({ sql, params: params || [] })
    if (opts.poolResponses) return opts.poolResponses(sql)
    if (sql.includes('COUNT(*)')) return [[{ total: 0 }]]
    if (sql.includes('SUM(amount)')) return [[]]
    if (sql.startsWith('INSERT') || sql.includes('INSERT')) return [{ insertId: 1, affectedRows: 1 }]
    if (sql.startsWith('UPDATE')) return [{ affectedRows: 1 }]
    if (sql.startsWith('DELETE')) return [{ affectedRows: 1 }]
    return [[]]
  })
  vi.stubGlobal('getPool', () => ({ query: mockPoolQueryFn, getConnection: vi.fn() }))
}

describe('FinanceBudgetModel.upsert', () => {
  let FinanceBudgetModel: any

  beforeEach(async () => {
    setupBudgetMocks()
    const mod = await import('../../server/utils/models/finance-budget.model')
    FinanceBudgetModel = mod.FinanceBudgetModel
  })

  it('should INSERT with ON DUPLICATE KEY UPDATE', async () => {
    await FinanceBudgetModel.upsert(1, {
      category_id: null,
      year_month: '2026-03',
      amount: 5000,
    })
    const call = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(call).toBeDefined()
    expect(call.sql).toContain('ON DUPLICATE KEY UPDATE')
    expect(call.params).toEqual([1, null, '2026-03', 5000])
  })

  it('should support category budget', async () => {
    await FinanceBudgetModel.upsert(1, {
      category_id: 5,
      year_month: '2026-03',
      amount: 1500,
    })
    const call = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(call.params).toEqual([1, 5, '2026-03', 1500])
  })
})

describe('FinanceBudgetModel.update', () => {
  let FinanceBudgetModel: any

  beforeEach(async () => {
    setupBudgetMocks()
    const mod = await import('../../server/utils/models/finance-budget.model')
    FinanceBudgetModel = mod.FinanceBudgetModel
  })

  it('should update amount via Drizzle set()', async () => {
    await FinanceBudgetModel.update(1, 1, { amount: 6000 })
    expect(setCalls).toHaveLength(1)
    expect(setCalls[0]).toEqual({ amount: '6000' })
  })

  it('should return false when no fields', async () => {
    const result = await FinanceBudgetModel.update(1, 1, {})
    expect(result).toBe(false)
  })
})

describe('FinanceBudgetModel.delete', () => {
  let FinanceBudgetModel: any

  beforeEach(async () => {
    setupBudgetMocks()
    const mod = await import('../../server/utils/models/finance-budget.model')
    FinanceBudgetModel = mod.FinanceBudgetModel
  })

  it('should delete via Drizzle without error', async () => {
    const result = await FinanceBudgetModel.delete(5, 1)
    expect(result).toBe(true)
  })
})

describe('FinanceBudgetModel.findByMonth', () => {
  let FinanceBudgetModel: any

  beforeEach(async () => {
    setupBudgetMocks()
    const mod = await import('../../server/utils/models/finance-budget.model')
    FinanceBudgetModel = mod.FinanceBudgetModel
  })

  it('should query by user_id and year_month via Drizzle', async () => {
    const result = await FinanceBudgetModel.findByMonth(1, '2026-03')
    // Returns drizzleResult (empty array by default)
    expect(result).toEqual([])
  })
})

describe('FinanceBudgetModel.getProgress', () => {
  let FinanceBudgetModel: any

  beforeEach(async () => {
    setupBudgetMocks({
      poolResponses: (sql: string) => {
        if (sql.includes('SUM(amount)')) return [[]]
        return [[]]
      },
    })
    const mod = await import('../../server/utils/models/finance-budget.model')
    FinanceBudgetModel = mod.FinanceBudgetModel
  })

  it('should query budgets and spending for the month', async () => {
    const result = await FinanceBudgetModel.getProgress(1, '2026-03')
    expect(result).toHaveProperty('budgets')
    expect(result).toHaveProperty('spending')
    // Spending query goes through getPool
    const spendingCall = queryCalls.find(c => c.sql.includes('SUM(amount)'))!
    expect(spendingCall).toBeDefined()
    expect(spendingCall.params).toContain('2026-03-01')
    expect(spendingCall.params).toContain('2026-03-31')
  })
})

// ══════════════════════════════════════════════════════════════
// Budget API — Validation
// ══════════════════════════════════════════════════════════════

describe('Budget API — GET /finance/budgets', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceBudgetModel', {
      findByMonth: vi.fn().mockResolvedValue([]),
    })
    handler = (await import('../../server/api/finance/budgets/index.get')).default
  })

  it('should require year_month param', async () => {
    mockQuery({})
    await expectError(handler, 400, 'YYYY-MM')
  })

  it('should reject invalid year_month', async () => {
    mockQuery({ year_month: '2026-13' })
    await expectError(handler, 400, 'YYYY-MM')
  })

  it('should reject malformed year_month', async () => {
    mockQuery({ year_month: '2026-3' })
    await expectError(handler, 400, 'YYYY-MM')
  })

  it('should accept valid year_month', async () => {
    mockQuery({ year_month: '2026-03' })
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })

  it('should call requirePremium', async () => {
    mockQuery({ year_month: '2026-03' })
    await handler(event)
    expect(requirePremium).toHaveBeenCalled()
  })
})

describe('Budget API — POST /finance/budgets', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceBudgetModel', {
      upsert: vi.fn().mockResolvedValue(1),
      findByMonth: vi.fn().mockResolvedValue([]),
    })
    handler = (await import('../../server/api/finance/budgets/index.post')).default
  })

  it('should reject missing year_month', async () => {
    mockBody({ amount: 5000 })
    await expectError(handler, 400, 'YYYY-MM')
  })

  it('should reject invalid year_month format', async () => {
    mockBody({ year_month: '2026-00', amount: 5000 })
    await expectError(handler, 400, 'YYYY-MM')
  })

  it('should reject zero amount', async () => {
    mockBody({ year_month: '2026-03', amount: 0 })
    await expectError(handler, 400, '大于 0')
  })

  it('should reject negative amount', async () => {
    mockBody({ year_month: '2026-03', amount: -100 })
    await expectError(handler, 400, '大于 0')
  })

  it('should accept valid budget', async () => {
    mockBody({ year_month: '2026-03', amount: 5000 })
    const res = await handler(event)
    expect(res.success).toBe(true)
  })

  it('should accept category budget', async () => {
    mockBody({ year_month: '2026-03', amount: 1500, category_id: 1 })
    const res = await handler(event)
    expect(res.success).toBe(true)
  })

  it('should call requirePremium', async () => {
    mockBody({ year_month: '2026-03', amount: 5000 })
    await handler(event)
    expect(requirePremium).toHaveBeenCalled()
  })
})

describe('Budget API — DELETE /finance/budgets/:id', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceBudgetModel', {
      delete: vi.fn().mockResolvedValue(true),
    })
    handler = (await import('../../server/api/finance/budgets/[id].delete')).default
  })

  it('should reject invalid id', async () => {
    mockParam('abc')
    await expectError(handler, 400, '无效')
  })

  it('should return 404 when not found', async () => {
    vi.mocked((globalThis as any).FinanceBudgetModel.delete).mockResolvedValue(false)
    mockParam('999')
    await expectError(handler, 404, '不存在')
  })

  it('should delete successfully', async () => {
    mockParam('1')
    const res = await handler(event)
    expect(res.success).toBe(true)
  })

  it('should call requirePremium', async () => {
    mockParam('1')
    await handler(event)
    expect(requirePremium).toHaveBeenCalled()
  })
})

describe('Budget API — GET /finance/budgets/progress', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('FinanceBudgetModel', {
      findByMonth: vi.fn().mockResolvedValue([]),
      getProgress: vi.fn().mockResolvedValue({
        budgets: [],
        spending: [],
      }),
    })
    handler = (await import('../../server/api/finance/budgets/progress.get')).default
  })

  it('should require year_month', async () => {
    mockQuery({})
    await expectError(handler, 400, 'YYYY-MM')
  })

  it('should reject invalid year_month', async () => {
    mockQuery({ year_month: '202603' })
    await expectError(handler, 400, 'YYYY-MM')
  })

  it('should return null when no budgets set', async () => {
    mockQuery({ year_month: '2026-03' })
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
  })

  it('should compute progress with total budget', async () => {
    vi.mocked((globalThis as any).FinanceBudgetModel.getProgress).mockResolvedValue({
      budgets: [
        { id: 1, category_id: null, year_month: '2026-03', amount: 5000, category_name: null, category_icon: null },
        { id: 2, category_id: 1, year_month: '2026-03', amount: 1500, category_name: '餐饮', category_icon: '🍽️' },
      ],
      spending: [
        { category_id: 1, spent: 1200 },
        { category_id: 2, spent: 800 },
      ],
    })
    mockQuery({ year_month: '2026-03' })
    const res = await handler(event)
    expect(res.success).toBe(true)
    expect(res.data.total_budget).toBe(5000)
    expect(res.data.total_spent).toBe(2000)
    expect(res.data.percentage).toBe(40)
    expect(res.data.remaining).toBe(3000)
    expect(res.data.categories).toHaveLength(1)
    expect(res.data.categories[0].category_name).toBe('餐饮')
    expect(res.data.categories[0].spent).toBe(1200)
    expect(res.data.categories[0].percentage).toBe(80)
    expect(res.data.categories[0].status).toBe('warning')
  })

  it('should mark over-budget categories', async () => {
    vi.mocked((globalThis as any).FinanceBudgetModel.getProgress).mockResolvedValue({
      budgets: [
        { id: 1, category_id: null, year_month: '2026-03', amount: 1000 },
        { id: 2, category_id: 1, year_month: '2026-03', amount: 500, category_name: '餐饮', category_icon: '🍽️' },
      ],
      spending: [
        { category_id: 1, spent: 600 },
      ],
    })
    mockQuery({ year_month: '2026-03' })
    const res = await handler(event)
    const cat = res.data.categories[0]
    expect(cat.percentage).toBe(120)
    expect(cat.status).toBe('over')
  })

  it('should call requirePremium', async () => {
    mockQuery({ year_month: '2026-03' })
    await handler(event)
    expect(requirePremium).toHaveBeenCalled()
  })
})
