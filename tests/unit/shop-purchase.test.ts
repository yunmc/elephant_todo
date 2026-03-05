/**
 * Shop Purchase Logic Unit Tests
 *
 * Tests purchaseProduct function with mocked DB
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock product data
const mockProduct = {
  id: 2, type: 'skin', name: '牛皮纸', price: 20, asset_key: 'kraft',
  status: 'active', is_free: 0, is_limited: 0,
  limited_start: null, limited_end: null,
}
const mockFreeProduct = { ...mockProduct, id: 1, name: '简约默认', price: 0, is_free: 1, asset_key: 'default' }
const mockBundleProduct = { ...mockProduct, id: 10, type: 'bundle', name: '套装', price: 50, asset_key: 'bundle1' }
const mockLimitedExpired = {
  ...mockProduct, id: 11, name: '限时', is_limited: 1,
  limited_end: new Date('2020-01-01'),
}
const mockLimitedFuture = {
  ...mockProduct, id: 12, name: '未上架', is_limited: 1,
  limited_start: new Date('2099-01-01'), limited_end: new Date('2099-12-31'),
}

let purchaseProduct: (userId: number, productId: number) => Promise<void>
let queryCalls: Array<{ sql: string; params: any[] }>

function setupMocks(overrides: {
  productResult?: any,
  ownedResult?: any[],
  updateResult?: { affectedRows: number },
  bundleItems?: any[],
} = {}) {
  queryCalls = []

  // ShopProductModel.findById
  vi.stubGlobal('ShopProductModel', {
    findById: vi.fn().mockResolvedValue(overrides.productResult ?? mockProduct),
    getBundleItems: vi.fn().mockResolvedValue(overrides.bundleItems ?? []),
  })

  // Mock connection with transaction support
  const mockConn = {
    beginTransaction: vi.fn(),
    query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
      queryCalls.push({ sql, params: params || [] })
      // FOR UPDATE → wallet row
      if (sql.includes('FOR UPDATE')) return [[{ balance: 100 }]]
      // isOwned check
      if (sql.includes('user_products') && sql.includes('SELECT')) return [overrides.ownedResult ?? []]
      // UPDATE balance
      if (sql.includes('UPDATE user_wallets')) return [overrides.updateResult ?? { affectedRows: 1 }]
      // SELECT balance after deduct
      if (sql.includes('SELECT balance') && !sql.includes('FOR UPDATE')) return [[{ balance: 80 }]]
      // INSERT
      if (sql.includes('INSERT')) return [{ insertId: 1, affectedRows: 1 }]
      return [[]]
    }),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  }

  vi.stubGlobal('getPool', () => ({
    query: vi.fn(),
    getConnection: vi.fn().mockResolvedValue(mockConn),
  }))
}

describe('purchaseProduct', () => {
  beforeEach(async () => {
    setupMocks()
    const mod = await import('../../server/utils/shop-purchase')
    purchaseProduct = mod.purchaseProduct
  })

  it('should throw 404 for non-existent product', async () => {
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue(null),
      getBundleItems: vi.fn(),
    })
    const mod = await import('../../server/utils/shop-purchase')
    purchaseProduct = mod.purchaseProduct

    await expect(purchaseProduct(1, 999)).rejects.toThrow('商品不存在或已下架')
  })

  it('should throw 400 for free product', async () => {
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue(mockFreeProduct),
      getBundleItems: vi.fn(),
    })
    const mod = await import('../../server/utils/shop-purchase')
    purchaseProduct = mod.purchaseProduct

    await expect(purchaseProduct(1, 1)).rejects.toThrow('免费商品无需购买')
  })

  it('should throw 400 for already owned product', async () => {
    setupMocks({ ownedResult: [{ 1: 1 }] })
    const mod = await import('../../server/utils/shop-purchase')
    purchaseProduct = mod.purchaseProduct

    await expect(purchaseProduct(1, 2)).rejects.toThrow('已拥有该商品')
  })

  it('should throw 400 for expired limited product', async () => {
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue(mockLimitedExpired),
      getBundleItems: vi.fn(),
    })
    const mod = await import('../../server/utils/shop-purchase')
    purchaseProduct = mod.purchaseProduct

    await expect(purchaseProduct(1, 11)).rejects.toThrow('该商品已下架')
  })

  it('should throw 400 for not-yet-available limited product', async () => {
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue(mockLimitedFuture),
      getBundleItems: vi.fn(),
    })
    const mod = await import('../../server/utils/shop-purchase')
    purchaseProduct = mod.purchaseProduct

    await expect(purchaseProduct(1, 12)).rejects.toThrow('该商品尚未上架')
  })

  it('should throw 400 when balance insufficient', async () => {
    setupMocks({ updateResult: { affectedRows: 0 } })
    const mod = await import('../../server/utils/shop-purchase')
    purchaseProduct = mod.purchaseProduct

    await expect(purchaseProduct(1, 2)).rejects.toThrow('象币余额不足')
  })

  it('should complete purchase successfully', async () => {
    setupMocks()
    const mod = await import('../../server/utils/shop-purchase')
    purchaseProduct = mod.purchaseProduct

    await purchaseProduct(1, 2)
    // Should have: FOR UPDATE, SELECT owned, UPDATE balance, SELECT balance, INSERT tx, INSERT product
    expect(queryCalls.length).toBeGreaterThanOrEqual(5)
    const insertProduct = queryCalls.find(c => c.sql.includes('INSERT IGNORE INTO user_products'))
    expect(insertProduct).toBeTruthy()
    expect(insertProduct?.params).toContain(2) // product_id
  })

  it('should rollback on error and release connection', async () => {
    // Setup mocks where UPDATE balance fails with a generic error
    queryCalls = []
    const mockConn = {
      beginTransaction: vi.fn(),
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FOR UPDATE')) return [[{ balance: 100 }]]
        if (sql.includes('user_products') && sql.includes('SELECT')) return [[]]
        if (sql.includes('UPDATE user_wallets')) throw new Error('DB_ERROR')
        return [[]]
      }),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    }
    vi.stubGlobal('getPool', () => ({
      query: vi.fn(),
      getConnection: vi.fn().mockResolvedValue(mockConn),
    }))
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue(mockProduct),
      getBundleItems: vi.fn().mockResolvedValue([]),
    })
    const mod = await import('../../server/utils/shop-purchase')
    purchaseProduct = mod.purchaseProduct

    await expect(purchaseProduct(1, 2)).rejects.toThrow('DB_ERROR')
    expect(mockConn.rollback).toHaveBeenCalled()
    expect(mockConn.release).toHaveBeenCalled()
    expect(mockConn.commit).not.toHaveBeenCalled()
  })

  it('should unlock bundle sub-products', async () => {
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue(mockBundleProduct),
      getBundleItems: vi.fn().mockResolvedValue([
        { id: 1, bundle_id: 10, product_id: 2 },
        { id: 2, bundle_id: 10, product_id: 3 },
      ]),
    })
    setupMocks({
      productResult: mockBundleProduct,
      bundleItems: [
        { id: 1, bundle_id: 10, product_id: 2 },
        { id: 2, bundle_id: 10, product_id: 3 },
      ],
    })
    // Re-stub ShopProductModel after setupMocks since setupMocks overrides it
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue(mockBundleProduct),
      getBundleItems: vi.fn().mockResolvedValue([
        { id: 1, bundle_id: 10, product_id: 2 },
        { id: 2, bundle_id: 10, product_id: 3 },
      ]),
    })
    const mod = await import('../../server/utils/shop-purchase')
    purchaseProduct = mod.purchaseProduct

    await purchaseProduct(1, 10)
    // Should have INSERT IGNORE for bundle + 2 sub-products = 3 INSERT IGNORE statements
    const inserts = queryCalls.filter(c => c.sql.includes('INSERT IGNORE INTO user_products'))
    expect(inserts.length).toBeGreaterThanOrEqual(3)
  })
})
