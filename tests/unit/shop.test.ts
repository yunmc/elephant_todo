/**
 * Shop Model Unit Tests
 *
 * Tests ShopProductModel, WalletModel, UserProductModel, UserAppearanceModel
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
// ShopProductModel
// ══════════════════════════════════════════════════════════════

describe('ShopProductModel.findAll', () => {
  let ShopProductModel: any

  beforeEach(async () => {
    setupDbMock((sql) => {
      if (sql.includes('shop_products')) {
        return [[
          { id: 1, type: 'skin', name: '简约默认', asset_key: 'default', status: 'active', is_free: 1, price: 0 },
          { id: 2, type: 'skin', name: '牛皮纸', asset_key: 'kraft', status: 'active', is_free: 0, price: 20 },
        ]]
      }
      return [[]]
    })
    const mod = await import('../../server/utils/models/shop.model')
    ShopProductModel = mod.ShopProductModel
  })

  it('should return active products', async () => {
    const rows = await ShopProductModel.findAll()
    expect(rows).toHaveLength(2)
    const call = queryCalls[0]
    expect(call.sql).toContain("status = ?")
    expect(call.params).toContain('active')
    expect(call.sql).toContain('ORDER BY sort_order ASC')
  })

  it('should filter by type when provided', async () => {
    await ShopProductModel.findAll('skin')
    const call = queryCalls[0]
    expect(call.sql).toContain('type = ?')
    expect(call.params).toContain('skin')
  })
})

describe('ShopProductModel.findById', () => {
  let ShopProductModel: any

  beforeEach(async () => {
    setupDbMock((sql) => {
      if (sql.includes('WHERE id = ?')) {
        return [[{ id: 1, name: '牛皮纸', asset_key: 'kraft' }]]
      }
      return [[]]
    })
    const mod = await import('../../server/utils/models/shop.model')
    ShopProductModel = mod.ShopProductModel
  })

  it('should return the correct product', async () => {
    const product = await ShopProductModel.findById(1)
    expect(product).toBeTruthy()
    expect(product.name).toBe('牛皮纸')
    expect(queryCalls[0].params).toEqual([1])
  })
})

describe('ShopProductModel.getBundleProducts', () => {
  let ShopProductModel: any

  beforeEach(async () => {
    setupDbMock((sql) => {
      if (sql.includes('shop_bundle_items')) {
        return [[
          { id: 1, name: '牛皮纸', asset_key: 'kraft' },
          { id: 2, name: '方格本', asset_key: 'grid' },
        ]]
      }
      return [[]]
    })
    const mod = await import('../../server/utils/models/shop.model')
    ShopProductModel = mod.ShopProductModel
  })

  it('should return bundle sub-products', async () => {
    const items = await ShopProductModel.getBundleProducts(10)
    expect(items).toHaveLength(2)
    expect(queryCalls[0].sql).toContain('shop_bundle_items')
    expect(queryCalls[0].params).toEqual([10])
  })
})

// ══════════════════════════════════════════════════════════════
// WalletModel
// ══════════════════════════════════════════════════════════════

describe('WalletModel.getOrCreate', () => {
  let WalletModel: any

  it('should return existing wallet', async () => {
    setupDbMock((sql) => {
      if (sql.includes('user_wallets') && sql.includes('SELECT')) {
        return [[{ user_id: 1, balance: 50, total_earned: 50, total_spent: 0 }]]
      }
      return [[]]
    })
    const mod = await import('../../server/utils/models/wallet.model')
    WalletModel = mod.WalletModel
    const wallet = await WalletModel.getOrCreate(1)
    expect(wallet.balance).toBe(50)
    // Should only SELECT, no INSERT
    expect(queryCalls).toHaveLength(1)
  })

  it('should create wallet when not found', async () => {
    let selectCount = 0
    setupDbMock((sql) => {
      if (sql.includes('SELECT') && sql.includes('user_wallets')) {
        selectCount++
        if (selectCount === 1) return [[]] // first SELECT: not found
        return [[{ user_id: 1, balance: 0, total_earned: 0, total_spent: 0 }]] // after INSERT
      }
      if (sql.includes('INSERT IGNORE')) return [{ affectedRows: 1 }]
      return [[]]
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
    setupDbMock((sql) => {
      if (sql.includes('COUNT(*)')) return [[{ total: 5 }]]
      if (sql.includes('wallet_transactions') && sql.includes('LIMIT')) {
        return [[
          { id: 1, type: 'reward', amount: 10, balance_after: 10, description: '注册奖励' },
        ]]
      }
      return [[]]
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
    queryCalls = []
    vi.stubGlobal('getDb', () => ({
      query: vi.fn(),
      getConnection: vi.fn().mockResolvedValue(mockConn),
    }))
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
// UserProductModel
// ══════════════════════════════════════════════════════════════

describe('UserProductModel', () => {
  let UserProductModel: any

  beforeEach(async () => {
    setupDbMock((sql) => {
      if (sql.includes('SELECT 1')) return [[{ 1: 1 }]]
      if (sql.includes('SELECT product_id')) return [[{ product_id: 1 }, { product_id: 2 }]]
      if (sql.includes('user_products up')) {
        return [[
          { id: 1, product_id: 1, type: 'skin', name: '牛皮纸', asset_key: 'kraft' },
        ]]
      }
      return [[]]
    })
    const mod = await import('../../server/utils/models/user-product.model')
    UserProductModel = mod.UserProductModel
  })

  it('isOwned returns true when product exists', async () => {
    const owned = await UserProductModel.isOwned(1, 1)
    expect(owned).toBe(true)
  })

  it('getOwnedIds returns Set of product IDs', async () => {
    const ids = await UserProductModel.getOwnedIds(1)
    expect(ids).toBeInstanceOf(Set)
    expect(ids.has(1)).toBe(true)
    expect(ids.has(2)).toBe(true)
  })

  it('getUserProducts returns products with details', async () => {
    const products = await UserProductModel.getUserProducts(1)
    expect(products).toHaveLength(1)
    expect(products[0].name).toBe('牛皮纸')
  })
})

// ══════════════════════════════════════════════════════════════
// UserAppearanceModel
// ══════════════════════════════════════════════════════════════

describe('UserAppearanceModel', () => {
  let UserAppearanceModel: any

  describe('get', () => {
    it('should return default when no record exists', async () => {
      setupDbMock(() => [[]])
      const mod = await import('../../server/utils/models/user-product.model')
      UserAppearanceModel = mod.UserAppearanceModel
      const result = await UserAppearanceModel.get(1)
      expect(result.skin_id).toBeNull()
      expect(result.skin).toBeNull()
    })

    it('should return appearance with skin details', async () => {
      setupDbMock((sql) => {
        if (sql.includes('user_appearance')) {
          return [[{
            skin_id: 2, sticker_pack_id: null, font_id: null,
            skin_name: '牛皮纸', skin_asset_key: 'kraft', skin_preview_url: null,
            sticker_name: null, sticker_asset_key: null,
            font_name: null, font_asset_key: null,
          }]]
        }
        return [[]]
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
      setupDbMock()
      const mod = await import('../../server/utils/models/user-product.model')
      UserAppearanceModel = mod.UserAppearanceModel
      await UserAppearanceModel.update(1, 2, null, null)
      const call = queryCalls[0]
      expect(call.sql).toContain('ON DUPLICATE KEY UPDATE')
      expect(call.params).toEqual([1, 2, null, null])
    })
  })
})
