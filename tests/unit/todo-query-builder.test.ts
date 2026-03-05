/**
 * TodoModel.findByUser — Query Builder Regression Tests
 *
 * Tests the dynamic SQL generation of TodoModel.findByUser():
 *   - Pagination bounds (page, limit, MAX_LIMIT clamping)
 *   - Sort whitelist (ALLOWED_SORT_BY, ALLOWED_SORT_ORDER)
 *   - Priority FIELD() ordering
 *   - Every filter condition (status, priority, category_id, search,
 *     due_filter [today/week/overdue], due_date_start, due_date_end, tag_id)
 *
 * Strategy: mock getPool().query to capture the SQL string + params,
 * then assert correct WHERE clauses and parameter ordering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need the REAL TodoModel, so import from source
let TodoModel: any

// Track SQL calls
let queryCalls: Array<{ sql: string; params: any[] }>

function setupDbMock() {
  queryCalls = []
  const mockQuery = vi.fn().mockImplementation((sql: string, params?: any[]) => {
    queryCalls.push({ sql, params: params || [] })
    // The first call is COUNT(*), the second is SELECT
    if (sql.includes('COUNT(*)')) {
      return [[ { total: 42 } ]]
    }
    return [[ /* empty todos */ ]]
  })
  vi.stubGlobal('getPool', () => ({ query: mockQuery }))
}

describe('TodoModel.findByUser — Pagination', () => {
  beforeEach(async () => {
    setupDbMock()
    // Re-import to pick up fresh getDb stub
    const mod = await import('../../server/utils/models/todo.model')
    TodoModel = mod.TodoModel
  })

  it('should default page=1, limit=20', async () => {
    await TodoModel.findByUser(1, {})
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    // Params end with [userId, limit, offset]
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(20) // limit
    expect(params[params.length - 1]).toBe(0)  // offset = (1-1)*20
  })

  it('should clamp page < 1 to 1', async () => {
    await TodoModel.findByUser(1, { page: -5 })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 1]).toBe(0) // offset = (1-1)*limit
  })

  it('should clamp page = 0 to 1', async () => {
    await TodoModel.findByUser(1, { page: 0 })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 1]).toBe(0) // offset = (1-1)*limit
  })

  it('should clamp negative limit to 1', async () => {
    await TodoModel.findByUser(1, { limit: -5 })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(1) // Math.max(1, -5) = 1
  })

  it('should treat limit=0 as default (20) because 0 is falsy', async () => {
    await TodoModel.findByUser(1, { limit: 0 })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(20) // 0 || 20 = 20
  })

  it('should clamp limit > MAX_LIMIT (100) to 100', async () => {
    await TodoModel.findByUser(1, { limit: 500 })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(100) // MAX_LIMIT = 100
  })

  it('should calculate offset correctly for page 3 limit 10', async () => {
    await TodoModel.findByUser(1, { page: 3, limit: 10 })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(10)  // limit
    expect(params[params.length - 1]).toBe(20)  // offset = (3-1)*10
  })

  it('should return total from COUNT query', async () => {
    const result = await TodoModel.findByUser(1, {})
    expect(result.total).toBe(42)
  })
})

describe('TodoModel.findByUser — Sort', () => {
  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/todo.model')
    TodoModel = mod.TodoModel
  })

  it('should default sort to created_at desc', async () => {
    await TodoModel.findByUser(1, {})
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    expect(selectCall.sql).toContain('ORDER BY t.created_at desc')
  })

  it('should allow sort_by=due_date', async () => {
    await TodoModel.findByUser(1, { sort_by: 'due_date' })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    expect(selectCall.sql).toContain('ORDER BY t.due_date')
  })

  it('should allow sort_by=priority with FIELD() ordering', async () => {
    await TodoModel.findByUser(1, { sort_by: 'priority' })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    expect(selectCall.sql).toContain("FIELD(t.priority, 'high', 'medium', 'low')")
  })

  it('should fallback invalid sort_by to created_at', async () => {
    await TodoModel.findByUser(1, { sort_by: 'hacked_column' })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    expect(selectCall.sql).toContain('ORDER BY t.created_at')
    expect(selectCall.sql).not.toContain('hacked_column')
  })

  it('should allow sort_order=asc', async () => {
    await TodoModel.findByUser(1, { sort_order: 'asc' })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    expect(selectCall.sql).toContain('asc')
  })

  it('should fallback invalid sort_order to desc', async () => {
    await TodoModel.findByUser(1, { sort_order: 'DROP TABLE' })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    expect(selectCall.sql).toContain('desc')
    expect(selectCall.sql).not.toContain('DROP TABLE')
  })
})

describe('TodoModel.findByUser — Filters', () => {
  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/todo.model')
    TodoModel = mod.TodoModel
  })

  it('should add status filter', async () => {
    await TodoModel.findByUser(1, { status: 'pending' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('t.status = ?')
    expect(countCall.params).toContain('pending')
  })

  it('should add priority filter', async () => {
    await TodoModel.findByUser(1, { priority: 'high' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('t.priority = ?')
    expect(countCall.params).toContain('high')
  })

  it('should add category_id filter', async () => {
    await TodoModel.findByUser(1, { category_id: 5 })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('t.category_id = ?')
    expect(countCall.params).toContain(5)
  })

  it('should add FULLTEXT search filter', async () => {
    await TodoModel.findByUser(1, { search: 'groceries' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('MATCH(t.title, t.description) AGAINST(? IN BOOLEAN MODE)')
    expect(countCall.params).toContain('groceries')
  })

  it('should add due_filter=today', async () => {
    await TodoModel.findByUser(1, { due_filter: 'today' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('DATE(t.due_date) = CURDATE()')
  })

  it('should add due_filter=week', async () => {
    await TodoModel.findByUser(1, { due_filter: 'week' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('t.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)')
  })

  it('should add due_filter=overdue', async () => {
    await TodoModel.findByUser(1, { due_filter: 'overdue' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('t.due_date < NOW()')
    expect(countCall.sql).toContain('t.status = "pending"')
  })

  it('should add due_date_start filter', async () => {
    await TodoModel.findByUser(1, { due_date_start: '2024-01-01' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('t.due_date >= ?')
    expect(countCall.params).toContain('2024-01-01')
  })

  it('should add due_date_end filter', async () => {
    await TodoModel.findByUser(1, { due_date_end: '2024-12-31' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('t.due_date <= ?')
    expect(countCall.params).toContain('2024-12-31')
  })

  it('should add tag_id filter with EXISTS subquery', async () => {
    await TodoModel.findByUser(1, { tag_id: 7 })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('EXISTS (SELECT 1 FROM todo_tags tt WHERE tt.todo_id = t.id AND tt.tag_id = ?)')
    expect(countCall.params).toContain(7)
  })

  it('should combine multiple filters', async () => {
    await TodoModel.findByUser(1, { status: 'pending', priority: 'high', category_id: 3 })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('t.status = ?')
    expect(countCall.sql).toContain('t.priority = ?')
    expect(countCall.sql).toContain('t.category_id = ?')
    expect(countCall.params).toEqual([1, 'pending', 'high', 3])
  })

  it('should NOT add filter when param is falsy/empty', async () => {
    await TodoModel.findByUser(1, { status: '', priority: undefined })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).not.toContain('t.status')
    expect(countCall.sql).not.toContain('t.priority')
  })

  it('should ignore unknown due_filter values', async () => {
    await TodoModel.findByUser(1, { due_filter: 'invalid' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).not.toContain('due_date')
  })
})
