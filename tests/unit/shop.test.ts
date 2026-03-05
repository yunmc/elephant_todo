/**
 * Shop Model Unit Tests (Drizzle ORM)
 *
 * Tests ShopProductModel (Drizzle), WalletModel (getPool),
 *       UserProductModel (Drizzle), UserAppearanceModel (getPool)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Drizzle proxy mock ──
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

// ── Pool query mock ──
let queryCalls: Array<{ sql: string; params: any[] }>

function setupMocks(opts: {
  drizzleResult?: any[]
  poolResponses?: (sql: string) => any
  poolConn?: any
} = {}) {
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
    if (sql.startsWith('INSERT') || sql.includes('INSERT')) return [{ insertId: 1, affectedRows: 1 }]
    if (sql.startsWith('UPDATE')) return [{ affectedRows: 1 }]
    if (sql.startsWith('DELETE')) return [{ affectedRows: 1 }]
    return [[]]
  })
  vi.stubGlobal('getPool', () => ({
    query: mockPoolQueryFn,
    getConnection: opts.poolConn ? vi.fn().mockResolvedValue(opts.poolConn) : vi.fn(),
  }))
}

// ══════════════════════════════════════════════════════════════
// ShopProductModel (Drizzle)
// ══════════════════════════════════════════════════════════════

describe('ShopProductModel.findAll', () => {
  let ShopProductModel: any

  beforeEach(async () => {
    setupMocks({
      drizzleResult: [
        { id: 1, type: 'skin', name: '简约默认', asset_key: 'default', status: 'active', is_free: 1, price: 0 },
        { id: 2, type: 'skin', name: '牛皮纸', asset_key: 'kraft', status: 'active', is_free: 0, price: 20 },
      ],
    })
    const mod = await import('../../server/utils/models/shop.model')
    ShopProductModel = mod.ShopProductModel
  })

  it('should return active products', async () => {
    const rows = await ShopProductModel.findAll()
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('简约默认')
  })

  it('should handle type filter without error', async () => {
    const rows = await ShopProductModel.findAll('skin')
    expect(rows).toHaveLength(2)
  })
})

describe('ShopProductModel.findById', () => {
  let ShopProductModel: any

  beforeEach(async () => {
    setupMocks({
      drizzleResult: [{ id: 1, name: '牛皮纸', asset_key: 'kraft' }],
    })
    const mod = await import('../../server/utils/models/shop.model')
    ShopProductModel = mod.ShopProductModel
  })

  it('should return the correct product', async () => {
    const product = await ShopProductModel.findById(1)
    expect(product).toBeTruthy()
    expect(product.name).toBe('牛皮纸')
  })
})

describe('ShopProductModel.getBundleProducts', () => {
  let ShopProductModel: any

  beforeEach(async () => {
    setupMocks({
      drizzleResult: [
        { id: 1, name: '牛皮纸', asset_key: 'kraft' },
        { id: 2, name: '方格本', asset_key: 'grid' },
      ],
    })
    const mod = await import('../../server/utils/models/shop.model')
    ShopProductModel = mod.ShopProductModel
  })

  it('should return bundle sub-products', async () => {
    const items = await ShopProductModel.getBundleProducts(10)
    expect(items).toHaveLength(2)
    expect(items[0].name).toBe('牛皮纸')
  })
})

// ══════════════════════════════════════════════════════════════
// WalletModel (getPool)
// ══════════════════════════════════════════════════════════════

describe('WalletModel.getOrCreate', () => {
  let WalletModel: any

  it('should return existing wallet', async () => {
    setupMocks({
      poolResponses: (sql) => {
        if (sql.includes('user_wallets') && sql.includes('SELECT')) {
          return [[{ user_id: 1, balance: 50, total_earned: 50, total_spent: 0 }]]
        }
        return [[]]
      },
    })
    const mod = await import('../../server/utils/models/wallet.model')
    WalletModel = mod.WalletModel
    const wallet = await WalletModel.getOrCreate(1)
    expect(wallet.balance).toBe(50)
    expect(queryCalls).toHaveLength(1)
  })

  it('should create wallet when not found', async () => {
    let selectCount = 0
    setupMocks({
      poolResponses: (sql) => {
        if (sql.includes('SELECT') && sql.includes('user_wallets')) {
          selectCount++
          if (selectCount === 1) return [[]] // first SELECT: not found
          return [[{ user_id: 1, balance: 0, total_earned: 0, total_spent: 0 }]]
        }
        if (sql.includes('INSERT IGNORE')) return [{ affectedRows: 1 }]
        return [[]]
      },
    })
    const mod = await import('../../server/utils/models/wallet.model')
    WalletModel = mod.WalletModel
    const wallet = await WalletModel.getOrCreate(1)
    expect(wallet.balance).toBe(0)
    const insertCall = queryCalls.find(c => c.sql.includes('INSERT IGNORE'))
    expect(insertCall).toBeTruthy()
  })
})

describe('WalletModel.getTransactions', () => {
  let WalletModel: any

  beforeEach(async () => {
    setupMocks({
      poolResponses: (sql) => {
        if (sql.includes('COUNT(*)')) return [[{ total: 5 }]]
        if (sql.includes('wallet_transactions') && sql.includes('LIMIT')) {
          return [[
            { id: 1, type: 'reward', amount: 10, balance_after: 10, description: '注册奖励' },
          ]]
        }
        return [[]]
      },
    })
    const mod = await import('../../server/utils/models/wallet.model')
    WalletModel = mod.WalletModel
  })

  it('should return paginated transactions', async () => {
    const result = await WalletModel.getTransactions(1, 1, 20)
    expect(result.total).toBe(5)
    expect(result.items).toHaveLength(1)
    const limitCall = queryCalls.find(c => c.sql.includes('LIMIT'))
    expect(limitCall?.params).toEqual([1, 20, 0])
  })
})

describe('WalletModel.addCoins', () => {
  let WalletModel: any

  beforeEach(async () => {
    queryCalls = []
    const mockConn = {
      beginTransaction: vi.fn(),
      query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
        queryCalls.push({ sql, params: params || [] })
        if (sql.includes('SELECT balance') && sql.includes('FOR UPDATE')) return [[{ balance: 50 }]]
        if (sql.includes('UPDATE')) return [{ affectedRows: 1 }]
        if (sql.includes('SELECT balance') && !sql.includes('FOR UPDATE')) return [[{ balance: 60 }]]
        if (sql.includes('INSERT')) return [{ insertId: 1, affectedRows: 1 }]
        return [[]]
      }),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    }
    setupMocks({ poolConn: mockConn })
    const mod = await import('../../server/utils/models/wallet.model')
    WalletModel = mod.WalletModel
  })

  it('should add coins correctly and return new balance', async () => {
    const balance = await WalletModel.addCoins(1, 10, 'reward', '测试奖励')
    expect(balance).toBe(60)
    const forUpdate = queryCalls.find(c => c.sql.includes('FOR UPDATE'))
    expect(forUpdate).toBeTruthy()
    const insertTx = queryCalls.find(c => c.sql.includes('wallet_transactions'))
    expect(insertTx?.params).toContain(10)
    expect(insertTx?.params).toContain(60)
  })
})

// ══════════════════════════════════════════════════════════════
// UserProductModel (Drizzle)
// ══════════════════════════════════════════════════════════════

describe('UserProductModel.isOwned', () => {
  it('returns true when product exists', async () => {
    setupMocks({ drizzleResult: [{ id: 1 }] })
    const mod = await import('../../server/utils/models/user-product.model')
    const owned = await mod.UserProductModel.isOwned(1, 1)
    expect(owned).toBe(true)
  })

  it('returns false when product not owned', async () => {
    setupMocks({ drizzleResult: [] })
    const mod = await import('../../server/utils/models/user-product.model')
    const owned = await mod.UserProductModel.isOwned(1, 999)
    expect(owned).toBe(false)
  })
})

describe('UserProductModel.getOwnedIds', () => {
  it('returns Set of product IDs', async () => {
    setupMocks({ drizzleResult: [{ product_id: 1 }, { product_id: 2 }] })
    const mod = await import('../../server/utils/models/user-product.model')
    const ids = await mod.UserProductModel.getOwnedIds(1)
    expect(ids).toBeInstanceOf(Set)
    expect(ids.has(1)).toBe(true)
    expect(ids.has(2)).toBe(true)
  })
})

describe('UserProductModel.getUserProducts', () => {
  it('returns products with details', async () => {
    setupMocks({
      drizzleResult: [
        { id: 1, product_id: 1, type: 'skin', name: '牛皮纸', asset_key: 'kraft' },
      ],
    })
    const mod = await import('../../server/utils/models/user-product.model')
    const products = await mod.UserProductModel.getUserProducts(1)
    expect(products).toHaveLength(1)
    expect(products[0].name).toBe('牛皮纸')
  })
})

// ══════════════════════════════════════════════════════════════
// UserAppearanceModel (getPool)
// ══════════════════════════════════════════════════════════════

describe('UserAppearanceModel', () => {
  let UserAppearanceModel: any

  describe('get', () => {
    it('should return default when no record exists', async () => {
      setupMocks({ poolResponses: () => [[]] })
      const mod = await import('../../server/utils/models/user-product.model')
      UserAppearanceModel = mod.UserAppearanceModel
      const result = await UserAppearanceModel.get(1)
      expect(result.skin_id).toBeNull()
      expect(result.skin).toBeNull()
    })

    it('should return appearance with skin details', async () => {
      setupMocks({
        poolResponses: (sql) => {
          if (sql.includes('user_appearance')) {
            return [[{
              skin_id: 2, sticker_pack_id: null, font_id: null,
              skin_name: '牛皮纸', skin_asset_key: 'kraft', skin_preview_url: null,
              sticker_name: null, sticker_asset_key: null,
              font_name: null, font_asset_key: null,
            }]]
          }
          return [[]]
        },
      })
      const mod = await import('../../server/utils/models/user-product.model')
      UserAppearanceModel = mod.UserAppearanceModel
      const result = await UserAppearanceModel.get(1)
      expect(result.skin_id).toBe(2)
      expect(result.skin?.name).toBe('牛皮纸')
      expect(result.skin?.asset_key).toBe('kraft')
    })
  })

  describe('update', () => {
    it('should upsert appearance', async () => {
      setupMocks()
      const mod = await import('../../server/utils/models/user-product.model')
      UserAppearanceModel = mod.UserAppearanceModel
      await UserAppearanceModel.update(1, 2, null, null)
      const call = queryCalls[0]
      expect(call.sql).toContain('ON DUPLICATE KEY UPDATE')
      expect(call.params).toEqual([1, 2, null, null])
    })
  })
})
