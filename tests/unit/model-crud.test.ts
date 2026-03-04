/**
 * Model CRUD Regression Tests (Phase 3)
 *
 * Tests the actual Model implementation (imported with mocked getDb):
 *   - Dynamic UPDATE field builders (every model)
 *   - CREATE default values
 *   - Batch operations (VaultModel.batchUpdateEntries, TodoModel.updateTags, batch helpers)
 *   - FinanceRecordModel.findByUser query builder
 *   - PeriodModel.recalculateCycleLengths SQL generation
 *   - PeriodModel.delete pre-fetch + post-recalculate chain
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let queryCalls: Array<{ sql: string; params: any[] }>
let mockQueryFn: ReturnType<typeof vi.fn>

function setupDbMock(customResponses?: (sql: string) => any) {
  queryCalls = []
  mockQueryFn = vi.fn().mockImplementation((sql: string, params?: any[]) => {
    queryCalls.push({ sql, params: params || [] })
    if (customResponses) return customResponses(sql)
    if (sql.includes('COUNT(*)')) return [[{ total: 0 }]]
    if (sql.startsWith('INSERT')) return [{ insertId: 1, affectedRows: 1 }]
    if (sql.startsWith('UPDATE')) return [{ affectedRows: 1 }]
    if (sql.startsWith('DELETE')) return [{ affectedRows: 1 }]
    return [[]]
  })
  vi.stubGlobal('getDb', () => ({ query: mockQueryFn }))
}

// ══════════════════════════════════════════════════════════════
// TodoModel — update dynamic builder + updateTags + batch helpers
// ══════════════════════════════════════════════════════════════

describe('TodoModel.update — dynamic field builder', () => {
  let TodoModel: any

  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/todo.model')
    TodoModel = mod.TodoModel
  })

  it('should build SET clause for title only', async () => {
    await TodoModel.update(1, 1, { title: 'New Title' })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('title = ?')
    expect(call.sql).not.toContain('description')
    expect(call.params).toEqual(['New Title', 1, 1])
  })

  it('should build SET clause for multiple fields', async () => {
    await TodoModel.update(1, 1, { title: 'T', description: 'D', priority: 'high' })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('title = ?')
    expect(call.sql).toContain('description = ?')
    expect(call.sql).toContain('priority = ?')
    expect(call.params).toEqual(['T', 'D', 'high', 1, 1])
  })

  it('should include category_id and due_date when provided', async () => {
    await TodoModel.update(1, 1, { category_id: 5, due_date: '2025-01-01' })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('category_id = ?')
    expect(call.sql).toContain('due_date = ?')
    expect(call.params).toEqual([5, '2025-01-01', 1, 1])
  })

  it('should return false when no fields provided', async () => {
    const result = await TodoModel.update(1, 1, {})
    expect(result).toBe(false)
    expect(queryCalls.filter(c => c.sql.includes('UPDATE'))).toHaveLength(0)
  })
})

describe('TodoModel.updateTags', () => {
  let TodoModel: any

  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/todo.model')
    TodoModel = mod.TodoModel
  })

  it('should delete all tags then insert new ones', async () => {
    await TodoModel.updateTags(1, [10, 20, 30])
    expect(queryCalls).toHaveLength(2)
    expect(queryCalls[0].sql).toContain('DELETE FROM todo_tags')
    expect(queryCalls[0].params).toEqual([1])
    expect(queryCalls[1].sql).toContain('INSERT INTO todo_tags')
  })

  it('should only delete when tagIds is empty', async () => {
    await TodoModel.updateTags(1, [])
    expect(queryCalls).toHaveLength(1)
    expect(queryCalls[0].sql).toContain('DELETE FROM todo_tags')
  })
})

describe('TodoModel.getTagsBatch', () => {
  let TodoModel: any

  beforeEach(async () => {
    setupDbMock((sql) => {
      if (sql.includes('todo_tags')) return [[
        { todo_id: 1, id: 10, name: 'tag1' },
        { todo_id: 1, id: 11, name: 'tag2' },
        { todo_id: 3, id: 12, name: 'tag3' },
      ]]
      return [[]]
    })
    const mod = await import('../../server/utils/models/todo.model')
    TodoModel = mod.TodoModel
  })

  it('should return empty map for empty todoIds', async () => {
    const result = await TodoModel.getTagsBatch([])
    expect(result.size).toBe(0)
    expect(queryCalls).toHaveLength(0) // no DB call
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
    setupDbMock((sql) => {
      if (sql.includes('ideas')) return [[
        { todo_id: 1, count: 3 },
        { todo_id: 3, count: 7 },
      ]]
      return [[]]
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
    setupDbMock()
    const mod = await import('../../server/utils/models/subtask.model')
    SubtaskModel = mod.SubtaskModel
  })

  it('should build SET clause for title only', async () => {
    await SubtaskModel.update(1, 10, { title: 'New' })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('title = ?')
    expect(call.params).toEqual(['New', 1, 10])
  })

  it('should build SET clause for status and sort_order', async () => {
    await SubtaskModel.update(1, 10, { status: 'completed', sort_order: 5 })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('status = ?')
    expect(call.sql).toContain('sort_order = ?')
    expect(call.params).toEqual(['completed', 5, 1, 10])
  })

  it('should return false when no fields provided', async () => {
    const result = await SubtaskModel.update(1, 10, {})
    expect(result).toBe(false)
  })
})

describe('SubtaskModel.create — auto sort_order', () => {
  let SubtaskModel: any

  beforeEach(async () => {
    setupDbMock((sql) => {
      if (sql.includes('COALESCE')) return [[{ next_order: 0 }]]
      if (sql.startsWith('INSERT')) return [{ insertId: 1, affectedRows: 1 }]
      return [[]]
    })
    const mod = await import('../../server/utils/models/subtask.model')
    SubtaskModel = mod.SubtaskModel
  })

  it('should use COALESCE(MAX(sort_order), -1) + 1 for auto ordering', async () => {
    await SubtaskModel.create(1, { title: 'New subtask' })
    const coalesceCall = queryCalls.find(c => c.sql.includes('COALESCE'))!
    expect(coalesceCall).toBeDefined()
    expect(coalesceCall.sql).toContain('MAX(sort_order)')
    const insertCall = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(insertCall.params).toContain(0) // sort_order from COALESCE result
  })
})

// ══════════════════════════════════════════════════════════════
// IdeaModel.update — dynamic field builder
// ══════════════════════════════════════════════════════════════

describe('IdeaModel.update — dynamic field builder', () => {
  let IdeaModel: any

  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/idea.model')
    IdeaModel = mod.IdeaModel
  })

  it('should build SET clause for content', async () => {
    await IdeaModel.update(1, 1, { content: 'Updated' })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('content = ?')
    expect(call.params).toEqual(['Updated', 1, 1])
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
    setupDbMock()
    const mod = await import('../../server/utils/models/vault.model')
    VaultModel = mod.VaultModel
  })

  it('should build SET for name + icon', async () => {
    await VaultModel.updateGroup(1, 1, { name: 'New', icon: '🔒' })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('name = ?')
    expect(call.sql).toContain('icon = ?')
    expect(call.params).toEqual(['New', '🔒', 1, 1])
  })

  it('should return false when no fields provided', async () => {
    const result = await VaultModel.updateGroup(1, 1, {})
    expect(result).toBe(false)
  })
})

describe('VaultModel.updateEntry — dynamic field builder', () => {
  let VaultModel: any

  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/vault.model')
    VaultModel = mod.VaultModel
  })

  it('should build SET for all 4 fields', async () => {
    await VaultModel.updateEntry(1, 1, {
      name: 'N', url: 'http://x', group_id: 2, encrypted_data: 'enc'
    })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('name = ?')
    expect(call.sql).toContain('url = ?')
    expect(call.sql).toContain('group_id = ?')
    expect(call.sql).toContain('encrypted_data = ?')
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
    const connQueryCalls: any[] = []
    mockConn = {
      beginTransaction: vi.fn(),
      query: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    }
    vi.stubGlobal('getDb', () => ({
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
      VaultModel.batchUpdateEntries(1, [{ id: 1, encrypted_data: 'x' }])
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
    setupDbMock()
    const mod = await import('../../server/utils/models/finance.model')
    FinanceCategoryModel = mod.FinanceCategoryModel
  })

  it('should build SET for name + type', async () => {
    await FinanceCategoryModel.update(1, 1, { name: 'Food', type: 'expense' })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('name = ?')
    expect(call.sql).toContain('type = ?')
    expect(call.params).toEqual(['Food', 'expense', 1, 1])
  })

  it('should return false when no fields', async () => {
    const result = await FinanceCategoryModel.update(1, 1, {})
    expect(result).toBe(false)
  })
})

describe('FinanceCategoryModel.create — default icon', () => {
  let FinanceCategoryModel: any

  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/finance.model')
    FinanceCategoryModel = mod.FinanceCategoryModel
  })

  it('should default icon to 💰 when not provided', async () => {
    await FinanceCategoryModel.create(1, { name: 'Test', type: 'expense' })
    const call = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(call.params).toContain('💰')
  })

  it('should use provided icon', async () => {
    await FinanceCategoryModel.create(1, { name: 'Test', type: 'income', icon: '💵' })
    const call = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(call.params).toContain('💵')
  })
})

// ══════════════════════════════════════════════════════════════
// FinanceRecordModel.update — dynamic field builder
// ══════════════════════════════════════════════════════════════

describe('FinanceRecordModel.update — dynamic field builder', () => {
  let FinanceRecordModel: any

  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/finance.model')
    FinanceRecordModel = mod.FinanceRecordModel
  })

  it('should build SET for all 5 fields', async () => {
    await FinanceRecordModel.update(1, 1, {
      category_id: 2, type: 'income', amount: 100, note: 'test', record_date: '2025-01-01'
    })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('category_id = ?')
    expect(call.sql).toContain('type = ?')
    expect(call.sql).toContain('amount = ?')
    expect(call.sql).toContain('note = ?')
    expect(call.sql).toContain('record_date = ?')
  })

  it('should return false when no fields', async () => {
    const result = await FinanceRecordModel.update(1, 1, {})
    expect(result).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// FinanceRecordModel.findByUser — query builder
// ══════════════════════════════════════════════════════════════

describe('FinanceRecordModel.findByUser — query builder', () => {
  let FinanceRecordModel: any

  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/finance.model')
    FinanceRecordModel = mod.FinanceRecordModel
  })

  it('should add type filter', async () => {
    await FinanceRecordModel.findByUser(1, { type: 'income' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('r.type = ?')
    expect(countCall.params).toContain('income')
  })

  it('should add category_id filter', async () => {
    await FinanceRecordModel.findByUser(1, { category_id: 5 })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('r.category_id = ?')
    expect(countCall.params).toContain(5)
  })

  it('should add start_date filter', async () => {
    await FinanceRecordModel.findByUser(1, { start_date: '2025-01-01' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('r.record_date >= ?')
    expect(countCall.params).toContain('2025-01-01')
  })

  it('should add end_date filter', async () => {
    await FinanceRecordModel.findByUser(1, { end_date: '2025-12-31' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('r.record_date <= ?')
    expect(countCall.params).toContain('2025-12-31')
  })

  it('should combine multiple filters', async () => {
    await FinanceRecordModel.findByUser(1, {
      type: 'expense', category_id: 3, start_date: '2025-01-01', end_date: '2025-12-31'
    })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('r.type = ?')
    expect(countCall.sql).toContain('r.category_id = ?')
    expect(countCall.sql).toContain('r.record_date >= ?')
    expect(countCall.sql).toContain('r.record_date <= ?')
  })

  it('should not add filters when params are empty', async () => {
    await FinanceRecordModel.findByUser(1, {})
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).not.toContain('r.type')
    expect(countCall.sql).not.toContain('r.category_id')
    expect(countCall.sql).not.toContain('record_date')
  })

  it('should default page=1, limit=50', async () => {
    await FinanceRecordModel.findByUser(1, {})
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(50) // limit
    expect(params[params.length - 1]).toBe(0)  // offset
  })
})

// ══════════════════════════════════════════════════════════════
// FinanceRecordModel.getStatistics — SQL aggregation
// ══════════════════════════════════════════════════════════════

describe('FinanceRecordModel.getStatistics — SQL aggregation', () => {
  let FinanceRecordModel: any

  beforeEach(async () => {
    setupDbMock((sql) => {
      if (sql.includes('CASE')) {
        return [[{ total_income: '1000.00', total_expense: '600.00' }]]
      }
      if (sql.includes('GROUP BY')) {
        return [[{ category_id: 1, category_name: 'Food', type: 'expense', total: 300 }]]
      }
      return [[]]
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
    // Both calls should have [userId, startDate, endDate]
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
    setupDbMock()
    const mod = await import('../../server/utils/models/important-date.model')
    ImportantDateModel = mod.ImportantDateModel
  })

  it('should build SET for title + date', async () => {
    await ImportantDateModel.update(1, 1, { title: 'Birthday', date: '2025-05-01' })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('title = ?')
    expect(call.sql).toContain('date = ?')
    expect(call.params).toEqual(['Birthday', '2025-05-01', 1, 1])
  })

  it('should build SET for all 7 optional fields', async () => {
    await ImportantDateModel.update(1, 1, {
      title: 'T', date: 'D', is_lunar: true, repeat_type: 'yearly',
      remind_days_before: 3, icon: '🎂', note: 'N'
    })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('is_lunar = ?')
    expect(call.sql).toContain('repeat_type = ?')
    expect(call.sql).toContain('remind_days_before = ?')
    expect(call.sql).toContain('icon = ?')
    expect(call.sql).toContain('note = ?')
  })

  it('should return false when no fields', async () => {
    const result = await ImportantDateModel.update(1, 1, {})
    expect(result).toBe(false)
  })
})

describe('ImportantDateModel.create — defaults', () => {
  let ImportantDateModel: any

  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/important-date.model')
    ImportantDateModel = mod.ImportantDateModel
  })

  it('should default is_lunar=false, repeat_type=none, remind_days=0, icon=📅', async () => {
    await ImportantDateModel.create(1, { title: 'Test', date: '2025-01-01' })
    const call = queryCalls.find(c => c.sql.includes('INSERT'))!
    // Params: [userId, title, date, is_lunar, repeat_type, remind_days_before, icon, note]
    expect(call.params[3]).toBe(false)    // is_lunar
    expect(call.params[4]).toBe('none')   // repeat_type
    expect(call.params[5]).toBe(0)        // remind_days_before
    expect(call.params[6]).toBe('📅')     // icon
    expect(call.params[7]).toBeNull()     // note
  })

  it('should use provided values over defaults', async () => {
    await ImportantDateModel.create(1, {
      title: 'T', date: 'D', is_lunar: true, repeat_type: 'yearly',
      remind_days_before: 7, icon: '🎉', note: 'note'
    })
    const call = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(call.params[3]).toBe(true)
    expect(call.params[4]).toBe('yearly')
    expect(call.params[5]).toBe(7)
    expect(call.params[6]).toBe('🎉')
    expect(call.params[7]).toBe('note')
  })
})

// ══════════════════════════════════════════════════════════════
// PeriodModel — update + create + delete + recalculate
// ══════════════════════════════════════════════════════════════

describe('PeriodModel.update — dynamic field builder', () => {
  let PeriodModel: any

  beforeEach(async () => {
    setupDbMock((sql) => {
      if (sql.startsWith('SELECT') && sql.includes('period_records') && !sql.includes('DISTINCT')) {
        // findById returns a record, findByUser returns all for recalculate
        return [[{ id: 1, person_name: '我', start_date: '2025-01-01' }]]
      }
      if (sql.startsWith('UPDATE')) return [{ affectedRows: 1 }]
      return [[]]
    })
    const mod = await import('../../server/utils/models/period.model')
    PeriodModel = mod.PeriodModel
  })

  it('should build SET for start_date + end_date', async () => {
    await PeriodModel.update(1, 1, { start_date: '2025-02-01', end_date: '2025-02-05' })
    const updateCall = queryCalls.find(c => c.sql.includes('UPDATE') && c.sql.includes('period_records SET'))!
    expect(updateCall.sql).toContain('start_date = ?')
    expect(updateCall.sql).toContain('end_date = ?')
  })

  it('should JSON.stringify symptoms', async () => {
    await PeriodModel.update(1, 1, { symptoms: ['cramps', 'headache'] })
    const updateCall = queryCalls.find(c => c.sql.includes('UPDATE') && c.sql.includes('period_records SET'))!
    expect(updateCall.sql).toContain('symptoms = ?')
    const symptomsParam = updateCall.params.find((p: any) => typeof p === 'string' && p.includes('cramps'))
    expect(symptomsParam).toBe('["cramps","headache"]')
  })

  it('should return false when no fields', async () => {
    const result = await PeriodModel.update(1, 1, {})
    expect(result).toBe(false)
  })

  it('should trigger recalculateCycleLengths after successful update', async () => {
    await PeriodModel.update(1, 1, { start_date: '2025-02-01' })
    // Should have: UPDATE + findById + findByUser (recalculate)
    const recalcSelect = queryCalls.filter(c =>
      c.sql.includes('SELECT') && c.sql.includes('period_records') && c.sql.includes('ORDER BY start_date')
    )
    expect(recalcSelect.length).toBeGreaterThan(0)
  })
})

describe('PeriodModel.create — defaults + recalculate', () => {
  let PeriodModel: any

  beforeEach(async () => {
    setupDbMock((sql) => {
      if (sql.startsWith('INSERT')) return [{ insertId: 1, affectedRows: 1 }]
      if (sql.startsWith('SELECT') && sql.includes('period_records')) return [[]]
      return [[]]
    })
    const mod = await import('../../server/utils/models/period.model')
    PeriodModel = mod.PeriodModel
  })

  it('should default person_name to "我"', async () => {
    await PeriodModel.create(1, { start_date: '2025-01-01' })
    const insertCall = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(insertCall.params[1]).toBe('我')
  })

  it('should use provided person_name', async () => {
    await PeriodModel.create(1, { start_date: '2025-01-01', person_name: 'Alice' })
    const insertCall = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(insertCall.params[1]).toBe('Alice')
  })

  it('should JSON.stringify symptoms in create', async () => {
    await PeriodModel.create(1, { start_date: '2025-01-01', symptoms: ['fatigue'] })
    const insertCall = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(insertCall.params[5]).toBe('["fatigue"]')
  })

  it('should default flow_level to moderate', async () => {
    await PeriodModel.create(1, { start_date: '2025-01-01' })
    const insertCall = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(insertCall.params[4]).toBe('moderate')
  })
})

describe('PeriodModel.delete — pre-fetch + recalculate chain', () => {
  let PeriodModel: any

  beforeEach(async () => {
    setupDbMock((sql) => {
      if (sql.includes('SELECT') && sql.includes('id = ?')) {
        return [[{ id: 1, person_name: '我', start_date: '2025-01-01' }]]
      }
      if (sql.startsWith('DELETE')) return [{ affectedRows: 1 }]
      if (sql.includes('SELECT') && sql.includes('ORDER BY')) return [[]] // recalculate finds 0
      return [[]]
    })
    const mod = await import('../../server/utils/models/period.model')
    PeriodModel = mod.PeriodModel
  })

  it('should return false if record not found', async () => {
    setupDbMock((sql) => {
      if (sql.includes('SELECT')) return [[]] // no record found
      return [[]]
    })
    const mod = await import('../../server/utils/models/period.model')
    const result = await mod.PeriodModel.delete(999, 1)
    expect(result).toBe(false)
  })

  it('should fetch record first, delete, then recalculate', async () => {
    const result = await PeriodModel.delete(1, 1)
    expect(result).toBe(true)
    // Should have: findById (SELECT), DELETE, recalculate SELECT
    const selectCalls = queryCalls.filter(c => c.sql.includes('SELECT'))
    const deleteCalls = queryCalls.filter(c => c.sql.includes('DELETE'))
    expect(selectCalls.length).toBeGreaterThanOrEqual(1)
    expect(deleteCalls).toHaveLength(1)
  })
})

describe('PeriodModel.findByUser — personName branch', () => {
  let PeriodModel: any

  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/period.model')
    PeriodModel = mod.PeriodModel
  })

  it('should add person_name WHERE clause when provided', async () => {
    await PeriodModel.findByUser(1, 'Alice')
    expect(queryCalls[0].sql).toContain('person_name = ?')
    expect(queryCalls[0].params).toEqual([1, 'Alice'])
  })

  it('should query without person_name when not provided', async () => {
    await PeriodModel.findByUser(1)
    expect(queryCalls[0].sql).not.toContain('person_name')
    expect(queryCalls[0].params).toEqual([1])
  })
})

// ══════════════════════════════════════════════════════════════
// CategoryModel — create default color + update builder
// ══════════════════════════════════════════════════════════════

describe('CategoryModel.create — default color', () => {
  let CategoryModel: any

  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/category.model')
    CategoryModel = mod.CategoryModel
  })

  it('should default color to #999999', async () => {
    await CategoryModel.create(1, { name: 'Work' })
    const call = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(call.params[2]).toBe('#999999')
  })

  it('should use provided color', async () => {
    await CategoryModel.create(1, { name: 'Work', color: '#FF0000' })
    const call = queryCalls.find(c => c.sql.includes('INSERT'))!
    expect(call.params[2]).toBe('#FF0000')
  })
})

describe('CategoryModel.update — dynamic field builder', () => {
  let CategoryModel: any

  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/category.model')
    CategoryModel = mod.CategoryModel
  })

  it('should build SET for name + color', async () => {
    await CategoryModel.update(1, 1, { name: 'New', color: '#000' })
    const call = queryCalls.find(c => c.sql.includes('UPDATE'))!
    expect(call.sql).toContain('name = ?')
    expect(call.sql).toContain('color = ?')
  })

  it('should return false when no fields', async () => {
    const result = await CategoryModel.update(1, 1, {})
    expect(result).toBe(false)
  })
})
