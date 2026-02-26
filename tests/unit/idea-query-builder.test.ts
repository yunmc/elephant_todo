/**
 * IdeaModel.findByUser — Query Builder Regression Tests
 *
 * Tests the dynamic SQL generation:
 *   - Pagination (page, limit, MAX_LIMIT=100)
 *   - Filters: linked (true/false), source (text/voice), search (FULLTEXT sanitization)
 *   - sanitizeFulltextSearch strips special chars
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let IdeaModel: any
let queryCalls: Array<{ sql: string; params: any[] }>

function setupDbMock() {
  queryCalls = []
  const mockQuery = vi.fn().mockImplementation((sql: string, params?: any[]) => {
    queryCalls.push({ sql, params: params || [] })
    if (sql.includes('COUNT(*)')) {
      return [[{ total: 10 }]]
    }
    return [[]]
  })
  vi.stubGlobal('getDb', () => ({ query: mockQuery }))
}

describe('IdeaModel.findByUser — Pagination', () => {
  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/idea.model')
    IdeaModel = mod.IdeaModel
  })

  it('should default page=1, limit=20', async () => {
    await IdeaModel.findByUser(1, {})
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(20) // limit
    expect(params[params.length - 1]).toBe(0)  // offset
  })

  it('should clamp page < 1 to 1', async () => {
    await IdeaModel.findByUser(1, { page: -1 })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 1]).toBe(0) // offset = 0
  })

  it('should clamp limit > 100 to 100', async () => {
    await IdeaModel.findByUser(1, { limit: 999 })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(100)
  })

  it('should clamp negative limit to 1', async () => {
    await IdeaModel.findByUser(1, { limit: -5 })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(1) // Math.max(1, -5) = 1
  })

  it('should treat limit=0 as default (20) because 0 is falsy', async () => {
    await IdeaModel.findByUser(1, { limit: 0 })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(20) // 0 || 20 = 20
  })
})

describe('IdeaModel.findByUser — Filters', () => {
  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/idea.model')
    IdeaModel = mod.IdeaModel
  })

  it('should add linked=true filter (todo_id IS NOT NULL)', async () => {
    await IdeaModel.findByUser(1, { linked: 'true' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('i.todo_id IS NOT NULL')
  })

  it('should add linked=false filter (todo_id IS NULL)', async () => {
    await IdeaModel.findByUser(1, { linked: 'false' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('i.todo_id IS NULL')
  })

  it('should ignore linked when not "true" or "false"', async () => {
    await IdeaModel.findByUser(1, { linked: 'maybe' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).not.toContain('todo_id IS')
  })

  it('should add source=text filter', async () => {
    await IdeaModel.findByUser(1, { source: 'text' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('i.source = ?')
    expect(countCall.params).toContain('text')
  })

  it('should add source=voice filter', async () => {
    await IdeaModel.findByUser(1, { source: 'voice' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('i.source = ?')
    expect(countCall.params).toContain('voice')
  })

  it('should ignore invalid source', async () => {
    await IdeaModel.findByUser(1, { source: 'hacked' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).not.toContain('i.source')
  })

  it('should add FULLTEXT search filter', async () => {
    await IdeaModel.findByUser(1, { search: 'shopping' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('MATCH(i.content) AGAINST(? IN BOOLEAN MODE)')
    expect(countCall.params).toContain('shopping')
  })

  it('should sanitize FULLTEXT special chars in search', async () => {
    await IdeaModel.findByUser(1, { search: '+hello -world "test"' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    // Special chars stripped, only words remain
    const searchParam = countCall.params.find((p: any) => typeof p === 'string' && p !== '' && p !== 'shopping')
    expect(searchParam).not.toContain('+')
    expect(searchParam).not.toContain('-')
    expect(searchParam).not.toContain('"')
  })

  it('should skip search if sanitized result is empty', async () => {
    await IdeaModel.findByUser(1, { search: '+++---' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).not.toContain('MATCH')
  })

  it('should combine multiple filters', async () => {
    await IdeaModel.findByUser(1, { linked: 'true', source: 'voice', search: 'note' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('todo_id IS NOT NULL')
    expect(countCall.sql).toContain('i.source = ?')
    expect(countCall.sql).toContain('MATCH(i.content)')
  })
})
