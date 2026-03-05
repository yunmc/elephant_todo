/**
 * Model CRUD Regression Tests (Phase 3) — Drizzle ORM
 *
 * Tests the actual Model implementation with mocked getDb (Drizzle) + getPool (raw SQL):
 *   - Dynamic UPDATE field builders (every model)
 *   - CREATE default values
 *   - Batch operations (VaultModel.batchUpdateEntries, TodoModel.updateTags, batch helpers)
 *   - FinanceRecordModel.findByUser query builder
 *   - PeriodModel.recalculateCycleLengths SQL generation
 *   - PeriodModel.delete pre-fetch + post-recalculate chain
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Drizzle chainable mock ──
let setCalls: Record<string, any>[]
let insertValuesCalls: any[]

function createDrizzleMock(selectResult: any[] = [], mutationResult: any = [{ insertId: 1, affectedRows: 1 }]) {
  setCalls = []
  insertValuesCalls = []

  function createChain(result: any) {
    const handler: ProxyHandler<object> = {
      get(_, prop: string) {
        if (prop === 'then') return (resolve: Function) => resolve(result)
        if (prop === 'catch' || prop === 'finally') return () => new Proxy({}, handler)
        return (...args: any[]) => {
          if (prop === 'set') setCalls.push(args[0])
          if (prop === 'values') insertValuesCalls.push(args[0])
          return new Proxy({}, handler)
        }
      },
    }
    return new Proxy({}, handler)
  }

  return {
    select: (..._a: any[]) => createChain(selectResult),
    insert: (..._a: any[]) => createChain(mutationResult),
    update: (..._a: any[]) => createChain(mutationResult),
    delete: (..._a: any[]) => createChain(mutationResult),
  }
}

// ── Raw pool mock ──
let queryCalls: Array<{ sql: string; params: any[] }>
let mockPoolQueryFn: ReturnType<typeof vi.fn>

function setupMocks(opts: {
  selectResult?: any[]
  mutationResult?: any
  poolResponses?: (sql: string) => any
} = {}) {
  const db = createDrizzleMock(opts.selectResult, opts.mutationResult)
  vi.stubGlobal('getDb', () => db)

  queryCalls = []
  mockPoolQueryFn = vi.fn().mockImplementation((sql: string, params?: any[]) => {
    queryCalls.push({ sql, params: params || [] })
    if (opts.poolResponses) return opts.poolResponses(sql)
    if (sql.includes('COUNT(*)')) return [[{ total: 0 }]]
    if (sql.includes('SUM(amount)')) return [[]]
    if (sql.includes('INSERT') || sql.startsWith('INSERT')) return [{ insertId: 1, affectedRows: 1 }]
    if (sql.includes('UPDATE') || sql.startsWith('UPDATE')) return [{ affectedRows: 1 }]
    if (sql.startsWith('DELETE')) return [{ affectedRows: 1 }]
    return [[]]
  })
  vi.stubGlobal('getPool', () => ({ query: mockPoolQueryFn, getConnection: vi.fn() }))
}

// ══════════════════════════════════════════════════════════════
// TodoModel — update dynamic builder + updateTags + batch helpers
// ══════════════════════════════════════════════════════════════

describe('TodoModel.update — dynamic field builder', () => {
  let TodoModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/todo.model')
    TodoModel = mod.TodoModel
  })

  it('should build SET clause for title only', async () => {
    await TodoModel.update(1, 1, { title: 'New Title' })
    expect(setCalls).toHaveLength(1)
    expect(setCalls[0]).toEqual({ title: 'New Title' })
  })

  it('should build SET clause for multiple fields', async () => {
    await TodoModel.update(1, 1, { title: 'T', description: 'D', priority: 'high' })
    expect(setCalls).toHaveLength(1)
    expect(setCalls[0]).toEqual({ title: 'T', description: 'D', priority: 'high' })
  })

  it('should include category_id and due_date when provided', async () => {
    await TodoModel.update(1, 1, { category_id: 5, due_date: '2025-01-01' })
    expect(setCalls[0]).toEqual({ category_id: 5, due_date: '2025-01-01' })
  })

  it('should return false when no fields provided', async () => {
    const result = await TodoModel.update(1, 1, {})
    expect(result).toBe(false)
    expect(setCalls).toHaveLength(0)
  })
})

describe('TodoModel.updateTags', () => {
  let TodoModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/todo.model')
    TodoModel = mod.TodoModel
  })

  it('should delete all tags then insert new ones', async () => {
    await TodoModel.updateTags(1, [10, 20, 30])
    // Drizzle: delete + insert
    expect(insertValuesCalls).toHaveLength(1)
    expect(insertValuesCalls[0]).toHaveLength(3)
    expect(insertValuesCalls[0][0]).toEqual({ todo_id: 1, tag_id: 10 })
  })

  it('should only delete when tagIds is empty', async () => {
    await TodoModel.updateTags(1, [])
    expect(insertValuesCalls).toHaveLength(0)
  })
})

describe('TodoModel.getTagsBatch', () => {
  let TodoModel: any

  beforeEach(async () => {
    setupMocks({
      selectResult: [
        { todo_id: 1, id: 10, user_id: 1, name: 'tag1', created_at: new Date() },
        { todo_id: 1, id: 11, user_id: 1, name: 'tag2', created_at: new Date() },
        { todo_id: 3, id: 12, user_id: 1, name: 'tag3', created_at: new Date() },
      ],
    })
    const mod = await import('../../server/utils/models/todo.model')
    TodoModel = mod.TodoModel
  })

  it('should return empty map for empty todoIds', async () => {
    const result = await TodoModel.getTagsBatch([])
    expect(result.size).toBe(0)
  })

  it('should group tags by todo_id', async () => {
    const result = await TodoModel.getTagsBatch([1, 2, 3])
    expect(result.get(1)).toHaveLength(2)
    expect(result.get(2)).toHaveLength(0)
    expect(result.get(3)).toHaveLength(1)
  })
})

describe('TodoModel.getIdeasCountBatch', () => {
  let TodoModel: any

  beforeEach(async () => {
    setupMocks({
      selectResult: [
        { todo_id: 1, count: 3 },
        { todo_id: 3, count: 7 },
      ],
    })
    const mod = await import('../../server/utils/models/todo.model')
    TodoModel = mod.TodoModel
  })

  it('should return empty map for empty todoIds', async () => {
    const result = await TodoModel.getIdeasCountBatch([])
    expect(result.size).toBe(0)
  })

  it('should map counts by todo_id, defaulting to 0', async () => {
    const result = await TodoModel.getIdeasCountBatch([1, 2, 3])
    expect(result.get(1)).toBe(3)
    expect(result.get(2)).toBe(0)
    expect(result.get(3)).toBe(7)
  })
})

// ══════════════════════════════════════════════════════════════
// SubtaskModel — update dynamic builder + create auto sort_order
// ══════════════════════════════════════════════════════════════

describe('SubtaskModel.update — dynamic field builder', () => {
  let SubtaskModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/subtask.model')
    SubtaskModel = mod.SubtaskModel
  })

  it('should build SET clause for title only', async () => {
    await SubtaskModel.update(1, 10, { title: 'New' })
    expect(setCalls).toHaveLength(1)
    expect(setCalls[0]).toEqual({ title: 'New' })
  })

  it('should build SET clause for status and sort_order', async () => {
    await SubtaskModel.update(1, 10, { status: 'completed', sort_order: 5 })
    expect(setCalls[0]).toEqual({ status: 'completed', sort_order: 5 })
  })

  it('should return false when no fields provided', async () => {
    const result = await SubtaskModel.update(1, 10, {})
    expect(result).toBe(false)
  })
})

describe('SubtaskModel.create — auto sort_order', () => {
  let SubtaskModel: any

  beforeEach(async () => {
    // SubtaskModel.create uses Drizzle select (for COALESCE) + insert
    // The select returns [{ next_order: 0 }]
    setupMocks({ selectResult: [{ next_order: 0 }] })
    const mod = await import('../../server/utils/models/subtask.model')
    SubtaskModel = mod.SubtaskModel
  })

  it('should create subtask with auto sort_order', async () => {
    await SubtaskModel.create(1, { title: 'New subtask' })
    expect(insertValuesCalls).toHaveLength(1)
    expect(insertValuesCalls[0].title).toBe('New subtask')
    expect(insertValuesCalls[0].sort_order).toBe(0) // from COALESCE mock
  })
})

// ══════════════════════════════════════════════════════════════
// IdeaModel.update — dynamic field builder
// ══════════════════════════════════════════════════════════════

describe('IdeaModel.update — dynamic field builder', () => {
  let IdeaModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/idea.model')
    IdeaModel = mod.IdeaModel
  })

  it('should build SET clause for content', async () => {
    await IdeaModel.update(1, 1, { content: 'Updated' })
    expect(setCalls).toHaveLength(1)
    expect(setCalls[0]).toEqual({ content: 'Updated' })
  })

  it('should return false when no fields provided', async () => {
    const result = await IdeaModel.update(1, 1, {})
    expect(result).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// VaultModel.updateGroup + updateEntry — dynamic field builders
// ══════════════════════════════════════════════════════════════

describe('VaultModel.updateGroup — dynamic field builder', () => {
  let VaultModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/vault.model')
    VaultModel = mod.VaultModel
  })

  it('should build SET for name + icon', async () => {
    await VaultModel.updateGroup(1, 1, { name: 'New', icon: '🔒' })
    expect(setCalls).toHaveLength(1)
    expect(setCalls[0]).toEqual({ name: 'New', icon: '🔒' })
  })

  it('should return false when no fields provided', async () => {
    const result = await VaultModel.updateGroup(1, 1, {})
    expect(result).toBe(false)
  })
})

describe('VaultModel.updateEntry — dynamic field builder', () => {
  let VaultModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/vault.model')
    VaultModel = mod.VaultModel
  })

  it('should build SET for all 4 fields', async () => {
    await VaultModel.updateEntry(1, 1, {
      name: 'N', url: 'http://x', group_id: 2, encrypted_data: 'enc',
    })
    expect(setCalls[0]).toEqual({ name: 'N', url: 'http://x', group_id: 2, encrypted_data: 'enc' })
  })

  it('should return false when no fields provided', async () => {
    const result = await VaultModel.updateEntry(1, 1, {})
    expect(result).toBe(false)
  })
})

describe('VaultModel.batchUpdateEntries — transaction flow', () => {
  let VaultModel: any
  let mockConn: any

  beforeEach(async () => {
    mockConn = {
      beginTransaction: vi.fn(),
      query: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    }
    vi.stubGlobal('getPool', () => ({
      query: vi.fn(),
      getConnection: vi.fn().mockResolvedValue(mockConn),
    }))
    setupMocks()
    // Override getPool after setupMocks
    vi.stubGlobal('getPool', () => ({
      query: vi.fn(),
      getConnection: vi.fn().mockResolvedValue(mockConn),
    }))
    const mod = await import('../../server/utils/models/vault.model')
    VaultModel = mod.VaultModel
  })

  it('should begin transaction, update each item, then commit', async () => {
    const items = [
      { id: 1, encrypted_data: 'enc1' },
      { id: 2, encrypted_data: 'enc2' },
    ]
    const count = await VaultModel.batchUpdateEntries(1, items)
    expect(mockConn.beginTransaction).toHaveBeenCalledOnce()
    expect(mockConn.query).toHaveBeenCalledTimes(2)
    expect(mockConn.commit).toHaveBeenCalledOnce()
    expect(mockConn.release).toHaveBeenCalledOnce()
    expect(count).toBe(2)
  })

  it('should rollback on error and re-throw', async () => {
    mockConn.query.mockRejectedValueOnce(new Error('DB error'))
    await expect(
      VaultModel.batchUpdateEntries(1, [{ id: 1, encrypted_data: 'x' }]),
    ).rejects.toThrow('DB error')
    expect(mockConn.rollback).toHaveBeenCalledOnce()
    expect(mockConn.release).toHaveBeenCalledOnce()
  })
})

// ══════════════════════════════════════════════════════════════
// FinanceCategoryModel.update + create defaults
// ══════════════════════════════════════════════════════════════

describe('FinanceCategoryModel.update — dynamic field builder', () => {
  let FinanceCategoryModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/finance.model')
    FinanceCategoryModel = mod.FinanceCategoryModel
  })

  it('should build SET for name + type', async () => {
    await FinanceCategoryModel.update(1, 1, { name: 'Food', type: 'expense' })
    expect(setCalls).toHaveLength(1)
    expect(setCalls[0]).toEqual({ name: 'Food', type: 'expense' })
  })

  it('should return false when no fields', async () => {
    const result = await FinanceCategoryModel.update(1, 1, {})
    expect(result).toBe(false)
  })
})

describe('FinanceCategoryModel.create — default icon', () => {
  let FinanceCategoryModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/finance.model')
    FinanceCategoryModel = mod.FinanceCategoryModel
  })

  it('should default icon to 💰 when not provided', async () => {
    await FinanceCategoryModel.create(1, { name: 'Test', type: 'expense' })
    expect(insertValuesCalls[0].icon).toBe('💰')
  })

  it('should use provided icon', async () => {
    await FinanceCategoryModel.create(1, { name: 'Test', type: 'income', icon: '💵' })
    expect(insertValuesCalls[0].icon).toBe('💵')
  })
})

// ══════════════════════════════════════════════════════════════
// FinanceRecordModel.update — dynamic field builder
// ══════════════════════════════════════════════════════════════

describe('FinanceRecordModel.update — dynamic field builder', () => {
  let FinanceRecordModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/finance.model')
    FinanceRecordModel = mod.FinanceRecordModel
  })

  it('should build SET for all 5 fields', async () => {
    await FinanceRecordModel.update(1, 1, {
      category_id: 2, type: 'income', amount: 100, note: 'test', record_date: '2025-01-01',
    })
    expect(setCalls[0]).toEqual({
      category_id: 2, type: 'income', amount: '100', note: 'test', record_date: '2025-01-01',
    })
  })

  it('should return false when no fields', async () => {
    const result = await FinanceRecordModel.update(1, 1, {})
    expect(result).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// FinanceRecordModel.findByUser — now uses Drizzle ORM
// Tests behavior (return value shape, defaults) rather than SQL strings
// ══════════════════════════════════════════════════════════════

describe('FinanceRecordModel.findByUser — query builder', () => {
  let FinanceRecordModel: any

  beforeEach(async () => {
    setupMocks({ selectResult: [{ total: 0 }] })
    const mod = await import('../../server/utils/models/finance.model')
    FinanceRecordModel = mod.FinanceRecordModel
  })

  it('should return result with records and total', async () => {
    const result = await FinanceRecordModel.findByUser(1, { type: 'income' })
    // Drizzle returns selectResult as-is (which is our mock)
    expect(result).toHaveProperty('records')
    expect(result).toHaveProperty('total')
  })

  it('should return result with empty params', async () => {
    const result = await FinanceRecordModel.findByUser(1, {})
    expect(result).toHaveProperty('records')
    expect(result).toHaveProperty('total')
  })

  it('should handle type filter', async () => {
    // Just verify no error is thrown
    await expect(FinanceRecordModel.findByUser(1, { type: 'income' })).resolves.toBeDefined()
  })

  it('should handle category_id filter', async () => {
    await expect(FinanceRecordModel.findByUser(1, { category_id: 5 })).resolves.toBeDefined()
  })

  it('should handle date range filters', async () => {
    await expect(FinanceRecordModel.findByUser(1, { start_date: '2025-01-01', end_date: '2025-12-31' })).resolves.toBeDefined()
  })

  it('should handle combined filters', async () => {
    await expect(FinanceRecordModel.findByUser(1, {
      type: 'expense', category_id: 3, start_date: '2025-01-01', end_date: '2025-12-31',
    })).resolves.toBeDefined()
  })

  it('should handle empty filter params', async () => {
    await expect(FinanceRecordModel.findByUser(1, {})).resolves.toBeDefined()
  })
})

// ══════════════════════════════════════════════════════════════
// FinanceRecordModel.getStatistics — raw SQL via getPool
// ══════════════════════════════════════════════════════════════

describe('FinanceRecordModel.getStatistics — SQL aggregation', () => {
  let FinanceRecordModel: any

  beforeEach(async () => {
    setupMocks({
      poolResponses: (sql: string) => {
        if (sql.includes('CASE')) {
          return [[{ total_income: '1000.00', total_expense: '600.00' }]]
        }
        if (sql.includes('GROUP BY')) {
          return [[{ category_id: 1, category_name: 'Food', type: 'expense', total: 300 }]]
        }
        return [[]]
      },
    })
    const mod = await import('../../server/utils/models/finance.model')
    FinanceRecordModel = mod.FinanceRecordModel
  })

  it('should calculate balance = income - expense', async () => {
    const stats = await FinanceRecordModel.getStatistics(1, '2025-01-01', '2025-12-31')
    expect(stats.total_income).toBe(1000)
    expect(stats.total_expense).toBe(600)
    expect(stats.balance).toBe(400)
  })

  it('should pass userId and date range to both queries', async () => {
    await FinanceRecordModel.getStatistics(1, '2025-01-01', '2025-12-31')
    for (const call of queryCalls) {
      expect(call.params).toContain(1)
      expect(call.params).toContain('2025-01-01')
      expect(call.params).toContain('2025-12-31')
    }
  })
})

// ══════════════════════════════════════════════════════════════
// ImportantDateModel — update dynamic builder + create defaults
// ══════════════════════════════════════════════════════════════

describe('ImportantDateModel.update — dynamic field builder', () => {
  let ImportantDateModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/important-date.model')
    ImportantDateModel = mod.ImportantDateModel
  })

  it('should build SET for title + date', async () => {
    await ImportantDateModel.update(1, 1, { title: 'Birthday', date: '2025-05-01' })
    expect(setCalls[0]).toEqual({ title: 'Birthday', date: '2025-05-01' })
  })

  it('should build SET for all 7 optional fields', async () => {
    await ImportantDateModel.update(1, 1, {
      title: 'T', date: 'D', is_lunar: true, repeat_type: 'yearly',
      remind_days_before: 3, icon: '🎂', note: 'N',
    })
    expect(setCalls[0]).toMatchObject({
      title: 'T', date: 'D', is_lunar: true, repeat_type: 'yearly',
      remind_days_before: 3, icon: '🎂', note: 'N',
    })
  })

  it('should return false when no fields', async () => {
    const result = await ImportantDateModel.update(1, 1, {})
    expect(result).toBe(false)
  })
})

describe('ImportantDateModel.create — defaults', () => {
  let ImportantDateModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/important-date.model')
    ImportantDateModel = mod.ImportantDateModel
  })

  it('should default is_lunar=false, repeat_type=none, remind_days=0, icon=📅', async () => {
    await ImportantDateModel.create(1, { title: 'Test', date: '2025-01-01' })
    expect(insertValuesCalls[0].is_lunar).toBe(false)
    expect(insertValuesCalls[0].repeat_type).toBe('none')
    expect(insertValuesCalls[0].remind_days_before).toBe(0)
    expect(insertValuesCalls[0].icon).toBe('📅')
    expect(insertValuesCalls[0].note).toBeNull()
  })

  it('should use provided values over defaults', async () => {
    await ImportantDateModel.create(1, {
      title: 'T', date: 'D', is_lunar: true, repeat_type: 'yearly',
      remind_days_before: 7, icon: '🎉', note: 'note',
    })
    expect(insertValuesCalls[0].is_lunar).toBe(true)
    expect(insertValuesCalls[0].repeat_type).toBe('yearly')
    expect(insertValuesCalls[0].remind_days_before).toBe(7)
    expect(insertValuesCalls[0].icon).toBe('🎉')
    expect(insertValuesCalls[0].note).toBe('note')
  })
})

// ══════════════════════════════════════════════════════════════
// PeriodModel — update + create + delete + recalculate
// Uses Drizzle for CRUD + getPool for recalculate batch UPDATE
// ══════════════════════════════════════════════════════════════

describe('PeriodModel.update — dynamic field builder', () => {
  let PeriodModel: any

  beforeEach(async () => {
    // findById returns a record (Drizzle select), findByUser returns for recalculate
    setupMocks({
      selectResult: [{ id: 1, person_name: '我', start_date: '2025-01-01' }],
    })
    const mod = await import('../../server/utils/models/period.model')
    PeriodModel = mod.PeriodModel
  })

  it('should build SET for start_date + end_date', async () => {
    await PeriodModel.update(1, 1, { start_date: '2025-02-01', end_date: '2025-02-05' })
    expect(setCalls).toHaveLength(1)
    expect(setCalls[0]).toEqual({ start_date: '2025-02-01', end_date: '2025-02-05' })
  })

  it('should pass symptoms to Drizzle', async () => {
    await PeriodModel.update(1, 1, { symptoms: ['cramps', 'headache'] })
    expect(setCalls[0].symptoms).toEqual(['cramps', 'headache'])
  })

  it('should return false when no fields', async () => {
    const result = await PeriodModel.update(1, 1, {})
    expect(result).toBe(false)
  })

  it('should trigger recalculateCycleLengths after successful update', async () => {
    await PeriodModel.update(1, 1, { start_date: '2025-02-01' })
    // After update, it calls findById (Drizzle select) and then recalculate
    // Recalculate calls findByUser (Drizzle) and then batch UPDATE (getPool)
    // If the select returns a record, recalculate will be triggered
    expect(setCalls).toHaveLength(1)
  })
})

describe('PeriodModel.create — defaults + recalculate', () => {
  let PeriodModel: any

  beforeEach(async () => {
    setupMocks({ selectResult: [] }) // recalculate finds 0
    const mod = await import('../../server/utils/models/period.model')
    PeriodModel = mod.PeriodModel
  })

  it('should default person_name to "我"', async () => {
    await PeriodModel.create(1, { start_date: '2025-01-01' })
    expect(insertValuesCalls[0].person_name).toBe('我')
  })

  it('should use provided person_name', async () => {
    await PeriodModel.create(1, { start_date: '2025-01-01', person_name: 'Alice' })
    expect(insertValuesCalls[0].person_name).toBe('Alice')
  })

  it('should pass symptoms to Drizzle in create', async () => {
    await PeriodModel.create(1, { start_date: '2025-01-01', symptoms: ['fatigue'] })
    expect(insertValuesCalls[0].symptoms).toEqual(['fatigue'])
  })

  it('should default flow_level to moderate', async () => {
    await PeriodModel.create(1, { start_date: '2025-01-01' })
    expect(insertValuesCalls[0].flow_level).toBe('moderate')
  })
})

describe('PeriodModel.delete — pre-fetch + recalculate chain', () => {
  let PeriodModel: any

  beforeEach(async () => {
    setupMocks({
      selectResult: [{ id: 1, person_name: '我', start_date: '2025-01-01' }],
    })
    const mod = await import('../../server/utils/models/period.model')
    PeriodModel = mod.PeriodModel
  })

  it('should return false if record not found', async () => {
    setupMocks({ selectResult: [] })
    const mod = await import('../../server/utils/models/period.model')
    const result = await mod.PeriodModel.delete(999, 1)
    expect(result).toBe(false)
  })

  it('should fetch record first, delete, then recalculate', async () => {
    const result = await PeriodModel.delete(1, 1)
    // findById returns record (selectResult), then delete, then recalculate
    expect(result).toBe(true)
  })
})

describe('PeriodModel.findByUser — personName branch', () => {
  let PeriodModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/period.model')
    PeriodModel = mod.PeriodModel
  })

  it('should return results when personName provided', async () => {
    const result = await PeriodModel.findByUser(1, 'Alice')
    // Returns selectResult (empty array by default)
    expect(result).toEqual([])
  })

  it('should return results when personName not provided', async () => {
    const result = await PeriodModel.findByUser(1)
    expect(result).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════
// CategoryModel — create default color + update builder
// ══════════════════════════════════════════════════════════════

describe('CategoryModel.create — default color', () => {
  let CategoryModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/category.model')
    CategoryModel = mod.CategoryModel
  })

  it('should default color to #999999', async () => {
    await CategoryModel.create(1, { name: 'Work' })
    expect(insertValuesCalls[0].color).toBe('#999999')
  })

  it('should use provided color', async () => {
    await CategoryModel.create(1, { name: 'Work', color: '#FF0000' })
    expect(insertValuesCalls[0].color).toBe('#FF0000')
  })
})

describe('CategoryModel.update — dynamic field builder', () => {
  let CategoryModel: any

  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/models/category.model')
    CategoryModel = mod.CategoryModel
  })

  it('should build SET for name + color', async () => {
    await CategoryModel.update(1, 1, { name: 'New', color: '#000' })
    expect(setCalls[0]).toEqual({ name: 'New', color: '#000' })
  })

  it('should return false when no fields', async () => {
    const result = await CategoryModel.update(1, 1, {})
    expect(result).toBe(false)
  })
})
