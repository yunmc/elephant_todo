/**
 * VaultModel.findEntries — Query Builder Regression Tests
 *
 * Tests dynamic WHERE clause construction:
 *   - group_id filter
 *   - search LIKE filter with special-char escaping (%_\)
 *   - Pagination
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let VaultModel: any
let queryCalls: Array<{ sql: string; params: any[] }>

function setupDbMock() {
  queryCalls = []
  const mockQuery = vi.fn().mockImplementation((sql: string, params?: any[]) => {
    queryCalls.push({ sql, params: params || [] })
    if (sql.includes('COUNT(*)')) {
      return [[{ total: 5 }]]
    }
    return [[]]
  })
  vi.stubGlobal('getDb', () => ({ query: mockQuery }))
}

describe('VaultModel.findEntries — Filters', () => {
  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/vault.model')
    VaultModel = mod.VaultModel
  })

  it('should filter by group_id', async () => {
    await VaultModel.findEntries(1, { group_id: 3 })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('group_id = ?')
    expect(countCall.params).toContain(3)
  })

  it('should add LIKE search filter for name and url', async () => {
    await VaultModel.findEntries(1, { search: 'google' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('name LIKE ?')
    expect(countCall.sql).toContain('url LIKE ?')
    expect(countCall.params).toContain('%google%')
  })

  it('should escape % in search term', async () => {
    await VaultModel.findEntries(1, { search: '100%' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    // The % in '100%' should be escaped to '100\\%' then wrapped
    const searchParams = countCall.params.filter((p: string) => typeof p === 'string' && p.includes('100'))
    expect(searchParams.length).toBeGreaterThan(0)
    searchParams.forEach((p: string) => {
      // '100%' should become '%100\\%%' - the literal % is escaped
      expect(p).toContain('100\\%')
    })
  })

  it('should escape _ in search term', async () => {
    await VaultModel.findEntries(1, { search: 'a_b' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    const searchParams = countCall.params.filter((p: string) => typeof p === 'string' && p.includes('a'))
    searchParams.forEach((p: string) => {
      expect(p).toContain('a\\_b')
    })
  })

  it('should escape backslash in search term', async () => {
    await VaultModel.findEntries(1, { search: 'a\\b' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    const searchParams = countCall.params.filter((p: string) => typeof p === 'string' && p.includes('a'))
    searchParams.forEach((p: string) => {
      expect(p).toContain('a\\\\b')
    })
  })

  it('should combine group_id and search filters', async () => {
    await VaultModel.findEntries(1, { group_id: 2, search: 'test' })
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).toContain('group_id = ?')
    expect(countCall.sql).toContain('name LIKE ?')
  })

  it('should not add filters when params are empty', async () => {
    await VaultModel.findEntries(1, {})
    const countCall = queryCalls.find(c => c.sql.includes('COUNT'))!
    expect(countCall.sql).not.toContain('group_id')
    expect(countCall.sql).not.toContain('LIKE')
  })
})

describe('VaultModel.findEntries — Pagination', () => {
  beforeEach(async () => {
    setupDbMock()
    const mod = await import('../../server/utils/models/vault.model')
    VaultModel = mod.VaultModel
  })

  it('should default page=1, limit=20', async () => {
    await VaultModel.findEntries(1, {})
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(20)
    expect(params[params.length - 1]).toBe(0)
  })

  it('should calculate offset for page 2 limit 10', async () => {
    await VaultModel.findEntries(1, { page: 2, limit: 10 })
    const selectCall = queryCalls.find(c => !c.sql.includes('COUNT'))!
    const params = selectCall.params
    expect(params[params.length - 2]).toBe(10)
    expect(params[params.length - 1]).toBe(10) // offset = (2-1)*10
  })

  it('should return total from COUNT query', async () => {
    const result = await VaultModel.findEntries(1, {})
    expect(result.total).toBe(5)
  })
})
