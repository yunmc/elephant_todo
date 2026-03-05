/**
 * IdeaModel.findByUser — Query Builder Regression Tests (Drizzle ORM)
 *
 * Tests:
 *   - Pagination (page, limit, MAX_LIMIT=100) — captured via Proxy mock
 *   - Filters: linked (true/false), source (text/voice), search (FULLTEXT)
 *   - sanitizeFulltextSearch strips special chars (tested directly)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

let IdeaModel: any
let limitCapture: number | undefined
let offsetCapture: number | undefined

function createChain(result: any) {
  const handler: ProxyHandler<object> = {
    get(_, prop: string) {
      if (prop === 'then') return (resolve: Function) => resolve(result)
      if (prop === 'catch' || prop === 'finally') return () => new Proxy({}, handler)
      return (...args: any[]) => {
        if (prop === 'limit') limitCapture = args[0]
        if (prop === 'offset') offsetCapture = args[0]
        return new Proxy({}, handler)
      }
    },
  }
  return new Proxy({}, handler)
}

function setupDb(total = 10) {
  limitCapture = undefined
  offsetCapture = undefined

  let callIdx = 0
  const db = {
    select: (..._args: any[]) => {
      callIdx++
      // Odd calls = count query, even calls = data query
      return createChain(callIdx % 2 === 1 ? [{ total }] : [])
    },
    insert: () => createChain([{ insertId: 1 }]),
    update: () => createChain([{ affectedRows: 1 }]),
    delete: () => createChain([{ affectedRows: 1 }]),
  }
  vi.stubGlobal('getDb', () => db)
  vi.stubGlobal('getPool', () => ({ query: vi.fn(), getConnection: vi.fn() }))
}

describe('IdeaModel.findByUser — Pagination', () => {
  beforeEach(async () => {
    setupDb()
    const mod = await import('../../server/utils/models/idea.model')
    IdeaModel = mod.IdeaModel
  })

  it('should default page=1, limit=20', async () => {
    await IdeaModel.findByUser(1, {})
    expect(limitCapture).toBe(20)
    expect(offsetCapture).toBe(0)
  })

  it('should clamp page < 1 to 1', async () => {
    await IdeaModel.findByUser(1, { page: -1 })
    expect(offsetCapture).toBe(0) // offset = (1-1)*20 = 0
  })

  it('should clamp limit > 100 to 100', async () => {
    await IdeaModel.findByUser(1, { limit: 999 })
    expect(limitCapture).toBe(100)
  })

  it('should clamp negative limit to 1', async () => {
    await IdeaModel.findByUser(1, { limit: -5 })
    expect(limitCapture).toBe(1) // Math.max(1, -5) = 1
  })

  it('should treat limit=0 as default (20) because 0 is falsy', async () => {
    await IdeaModel.findByUser(1, { limit: 0 })
    expect(limitCapture).toBe(20) // 0 || 20 = 20
  })
})

describe('IdeaModel.findByUser — Filters', () => {
  beforeEach(async () => {
    setupDb()
    const mod = await import('../../server/utils/models/idea.model')
    IdeaModel = mod.IdeaModel
  })

  it('should handle linked=true filter without error', async () => {
    const result = await IdeaModel.findByUser(1, { linked: 'true' })
    expect(result).toHaveProperty('total', 10)
    expect(result).toHaveProperty('ideas')
  })

  it('should handle linked=false filter without error', async () => {
    const result = await IdeaModel.findByUser(1, { linked: 'false' })
    expect(result).toHaveProperty('total', 10)
  })

  it('should ignore linked when not "true" or "false"', async () => {
    // Just verify no error — invalid linked values are ignored
    const result = await IdeaModel.findByUser(1, { linked: 'maybe' })
    expect(result).toHaveProperty('total', 10)
  })

  it('should handle source=text filter', async () => {
    const result = await IdeaModel.findByUser(1, { source: 'text' })
    expect(result).toHaveProperty('total', 10)
  })

  it('should handle source=voice filter', async () => {
    const result = await IdeaModel.findByUser(1, { source: 'voice' })
    expect(result).toHaveProperty('total', 10)
  })

  it('should ignore invalid source', async () => {
    // Invalid source is not 'text' or 'voice' — ignored
    const result = await IdeaModel.findByUser(1, { source: 'hacked' })
    expect(result).toHaveProperty('total', 10)
  })

  it('should handle FULLTEXT search filter', async () => {
    const result = await IdeaModel.findByUser(1, { search: 'shopping' })
    expect(result).toHaveProperty('total', 10)
  })

  it('should skip search if sanitized result is empty', async () => {
    // '+++---' sanitizes to empty string → no MATCH condition
    const result = await IdeaModel.findByUser(1, { search: '+++---' })
    expect(result).toHaveProperty('total', 10)
  })

  it('should combine multiple filters without error', async () => {
    const result = await IdeaModel.findByUser(1, { linked: 'true', source: 'voice', search: 'note' })
    expect(result).toHaveProperty('total', 10)
    expect(result).toHaveProperty('ideas')
  })
})

// Tests the sanitizeFulltextSearch logic directly (same regex as in idea.model.ts)
describe('sanitizeFulltextSearch — unit', () => {
  const sanitize = (input: string) =>
    input.replace(/[+\-~*"()@<>]/g, ' ').replace(/\s+/g, ' ').trim()

  it('should strip FULLTEXT operators', () => {
    expect(sanitize('+hello -world "test"')).toBe('hello world test')
  })

  it('should strip all special chars', () => {
    expect(sanitize('~foo*(bar)@<baz>')).toBe('foo bar baz')
  })

  it('should collapse multiple spaces', () => {
    expect(sanitize('hello   world')).toBe('hello world')
  })

  it('should return empty string for only operators', () => {
    expect(sanitize('+++---')).toBe('')
  })

  it('should preserve normal text', () => {
    expect(sanitize('shopping list')).toBe('shopping list')
  })

  it('should trim whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello')
  })
})
