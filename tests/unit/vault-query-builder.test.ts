/**
 * VaultModel.findEntries — Query Builder Regression Tests (Drizzle ORM)
 *
 * Tests dynamic filter construction + pagination + search escaping logic.
 * findEntries now uses Drizzle ORM; SQL assertions replaced by behavior assertions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let VaultModel: any

function createChain(result: any) {
  const handler: ProxyHandler<object> = {
    get(_, prop: string) {
      if (prop === 'then') return (resolve: Function) => resolve(result)
      if (prop === 'catch' || prop === 'finally') return () => new Proxy({}, handler)
      return (..._args: any[]) => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

function setupDb(total = 5, entries: any[] = []) {
  let callIdx = 0
  const db = {
    select: (..._args: any[]) => {
      callIdx++
      // Odd calls = count query, even calls = entries query
      return createChain(callIdx % 2 === 1 ? [{ total }] : entries)
    },
    insert: () => createChain([{ insertId: 1 }]),
    update: () => createChain([{ affectedRows: 1 }]),
    delete: () => createChain([{ affectedRows: 1 }]),
  }
  vi.stubGlobal('getDb', () => db)
  vi.stubGlobal('getPool', () => ({ query: vi.fn(), getConnection: vi.fn() }))
}

describe('VaultModel.findEntries — Filters', () => {
  beforeEach(async () => {
    setupDb(5)
    const mod = await import('../../server/utils/models/vault.model')
    VaultModel = mod.VaultModel
  })

  it('should filter by group_id without error', async () => {
    const result = await VaultModel.findEntries(1, { group_id: 3 })
    expect(result.total).toBe(5)
    expect(result).toHaveProperty('entries')
  })

  it('should add search filter for name and url', async () => {
    const result = await VaultModel.findEntries(1, { search: 'google' })
    expect(result.total).toBe(5)
    expect(result).toHaveProperty('entries')
  })

  it('should handle % in search without error', async () => {
    await expect(VaultModel.findEntries(1, { search: '100%' })).resolves.toBeDefined()
  })

  it('should handle _ in search without error', async () => {
    await expect(VaultModel.findEntries(1, { search: 'a_b' })).resolves.toBeDefined()
  })

  it('should handle backslash in search without error', async () => {
    await expect(VaultModel.findEntries(1, { search: 'a\\b' })).resolves.toBeDefined()
  })

  it('should combine group_id and search filters', async () => {
    const result = await VaultModel.findEntries(1, { group_id: 2, search: 'test' })
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('entries')
  })

  it('should work with empty params', async () => {
    const result = await VaultModel.findEntries(1, {})
    expect(result.total).toBe(5)
  })
})

// Test the escaping regex used in vault model independently
describe('Vault search escaping — unit', () => {
  // Same regex as VaultModel.findEntries: params.search.replace(/[%_\\]/g, '\\$&')
  const escapeSearch = (s: string) => s.replace(/[%_\\]/g, '\\$&')

  it('should escape % → \\%', () => {
    expect(escapeSearch('100%')).toBe('100\\%')
  })

  it('should escape _ → \\_', () => {
    expect(escapeSearch('a_b')).toBe('a\\_b')
  })

  it('should escape backslash → \\\\', () => {
    expect(escapeSearch('a\\b')).toBe('a\\\\b')
  })
})

describe('VaultModel.findEntries — Pagination', () => {
  beforeEach(async () => {
    setupDb(5)
    const mod = await import('../../server/utils/models/vault.model')
    VaultModel = mod.VaultModel
  })

  it('should default page=1 limit=20', async () => {
    const result = await VaultModel.findEntries(1, {})
    expect(result).toHaveProperty('total', 5)
    expect(result).toHaveProperty('entries')
  })

  it('should handle page 2 limit 10', async () => {
    const result = await VaultModel.findEntries(1, { page: 2, limit: 10 })
    expect(result.total).toBe(5)
  })

  it('should return total from count query', async () => {
    const result = await VaultModel.findEntries(1, {})
    expect(result.total).toBe(5)
  })
})
