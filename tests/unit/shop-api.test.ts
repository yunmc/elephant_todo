/**
 * Shop API Endpoint Unit Tests
 *
 * Tests all shop/wallet/user API handlers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ══════════════════════════════════════════════════════════════
// GET /api/shop/products
// ══════════════════════════════════════════════════════════════

describe('GET /api/shop/products', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAuth', vi.fn(() => 1))
    vi.stubGlobal('getQuery', vi.fn(() => ({})))
    vi.stubGlobal('ShopProductModel', {
      findAll: vi.fn().mockResolvedValue([
        { id: 1, name: '默认', is_free: 1, price: 0, asset_key: 'default' },
        { id: 2, name: '牛皮纸', is_free: 0, price: 20, asset_key: 'kraft' },
      ]),
    })
    vi.stubGlobal('UserProductModel', {
      getOwnedIds: vi.fn().mockResolvedValue(new Set([2])),
    })
    const mod = await import('../../server/api/shop/products.get')
    handler = mod.default
  })

  it('should return products with owned flag', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    // Free product → owned=true
    expect(result.data[0].owned).toBe(true)
    // Purchased product → owned=true
    expect(result.data[1].owned).toBe(true)
  })

  it('should filter by type', async () => {
    vi.stubGlobal('getQuery', vi.fn(() => ({ type: 'skin' })))
    const mod = await import('../../server/api/shop/products.get')
    handler = mod.default
    await handler({})
    expect(ShopProductModel.findAll).toHaveBeenCalledWith('skin')
  })
})

// ══════════════════════════════════════════════════════════════
// GET /api/shop/products/:id
// ══════════════════════════════════════════════════════════════

describe('GET /api/shop/products/:id', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAuth', vi.fn(() => 1))
    vi.stubGlobal('getRouterParam', vi.fn(() => '2'))
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue({
        id: 2, name: '牛皮纸', type: 'skin', status: 'active', is_free: 0, price: 20,
      }),
      getBundleProducts: vi.fn(),
    })
    vi.stubGlobal('UserProductModel', {
      isOwned: vi.fn().mockResolvedValue(false),
      getOwnedIds: vi.fn().mockResolvedValue(new Set()),
    })
    const mod = await import('../../server/api/shop/products/[id].get')
    handler = mod.default
  })

  it('should return product detail', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data.name).toBe('牛皮纸')
    expect(result.data.owned).toBe(false)
  })

  it('should return 404 for missing product', async () => {
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue(null),
    })
    const mod = await import('../../server/api/shop/products/[id].get')
    handler = mod.default

    await expect(handler({})).rejects.toThrow('商品不存在')
  })

  it('should return 400 for invalid ID', async () => {
    vi.stubGlobal('getRouterParam', vi.fn(() => 'abc'))
    const mod = await import('../../server/api/shop/products/[id].get')
    handler = mod.default
    await expect(handler({})).rejects.toThrow('无效的商品 ID')
  })

  it('should include bundle items for bundle type', async () => {
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue({
        id: 10, name: '套装', type: 'bundle', status: 'active', is_free: 0, price: 50,
      }),
      getBundleProducts: vi.fn().mockResolvedValue([
        { id: 2, name: '牛皮纸', is_free: 0 },
        { id: 3, name: '方格本', is_free: 0 },
      ]),
    })
    vi.stubGlobal('UserProductModel', {
      isOwned: vi.fn().mockResolvedValue(false),
      getOwnedIds: vi.fn().mockResolvedValue(new Set([2])),
    })
    const mod = await import('../../server/api/shop/products/[id].get')
    handler = mod.default
    const result = await handler({})
    expect(result.data.bundle_items).toHaveLength(2)
    expect(result.data.bundle_items[0].owned).toBe(true) // id=2 is owned
    expect(result.data.bundle_items[1].owned).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// POST /api/shop/purchase
// ══════════════════════════════════════════════════════════════

describe('POST /api/shop/purchase', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAuth', vi.fn(() => 1))
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ product_id: 2 }))
    vi.stubGlobal('purchaseProduct', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('WalletModel', {
      getOrCreate: vi.fn().mockResolvedValue({ balance: 30 }),
    })
    const mod = await import('../../server/api/shop/purchase.post')
    handler = mod.default
  })

  it('should purchase successfully', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data.balance).toBe(30)
    expect(result.message).toBe('购买成功')
    expect(purchaseProduct).toHaveBeenCalledWith(1, 2)
  })

  it('should throw 400 when product_id missing', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({}))
    const mod = await import('../../server/api/shop/purchase.post')
    handler = mod.default
    await expect(handler({})).rejects.toThrow('product_id 必填')
  })
})

// ══════════════════════════════════════════════════════════════
// GET /api/wallet
// ══════════════════════════════════════════════════════════════

describe('GET /api/wallet', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAuth', vi.fn(() => 1))
    vi.stubGlobal('WalletModel', {
      getOrCreate: vi.fn().mockResolvedValue({ balance: 50, total_earned: 60, total_spent: 10 }),
    })
    const mod = await import('../../server/api/wallet/index.get')
    handler = mod.default
  })

  it('should return wallet balance', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data.balance).toBe(50)
    expect(result.data.total_earned).toBe(60)
    expect(result.data.total_spent).toBe(10)
  })
})

// ══════════════════════════════════════════════════════════════
// GET /api/wallet/transactions
// ══════════════════════════════════════════════════════════════

describe('GET /api/wallet/transactions', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAuth', vi.fn(() => 1))
    vi.stubGlobal('getQuery', vi.fn(() => ({ page: '1', limit: '20' })))
    vi.stubGlobal('WalletModel', {
      getTransactions: vi.fn().mockResolvedValue({
        items: [{ id: 1, type: 'reward', amount: 10, balance_after: 10, description: '注册' }],
        total: 1,
      }),
    })
    const mod = await import('../../server/api/wallet/transactions.get')
    handler = mod.default
  })

  it('should return paginated transactions', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.pagination.total).toBe(1)
    expect(result.pagination.totalPages).toBe(1)
  })

  it('should clamp page to minimum 1 and limit to max 100', async () => {
    vi.stubGlobal('getQuery', vi.fn(() => ({ page: '-5', limit: '999' })))
    const mod = await import('../../server/api/wallet/transactions.get')
    handler = mod.default
    const result = await handler({})
    expect(result.pagination.page).toBe(1)
    expect(result.pagination.limit).toBe(100)
    // Verify model gets clamped values
    expect(WalletModel.getTransactions).toHaveBeenCalledWith(1, 1, 100)
  })
})

// ══════════════════════════════════════════════════════════════
// POST /api/wallet/add-coins (dev only)
// ══════════════════════════════════════════════════════════════

describe('POST /api/wallet/add-coins', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAuth', vi.fn(() => 1))
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ amount: 100 }))
    vi.stubGlobal('WalletModel', {
      getOrCreate: vi.fn().mockResolvedValue({ balance: 0 }),
      addCoins: vi.fn().mockResolvedValue(100),
    })
    const mod = await import('../../server/api/wallet/add-coins.post')
    handler = mod.default
  })

  it('should add coins in dev environment', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data.balance).toBe(100)
  })

  it('should reject in production', async () => {
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const mod = await import('../../server/api/wallet/add-coins.post')
    handler = mod.default
    await expect(handler({})).rejects.toThrow('此接口仅限开发环境使用')
    process.env.NODE_ENV = origEnv
  })

  it('should reject invalid amount', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ amount: 0 }))
    const mod = await import('../../server/api/wallet/add-coins.post')
    handler = mod.default
    await expect(handler({})).rejects.toThrow('amount 必须为')
  })

  it('should reject amount exceeding 10000', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ amount: 10001 }))
    const mod = await import('../../server/api/wallet/add-coins.post')
    handler = mod.default
    await expect(handler({})).rejects.toThrow('amount 必须为')
  })
})

// ══════════════════════════════════════════════════════════════
// GET /api/user/products
// ══════════════════════════════════════════════════════════════

describe('GET /api/user/products', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAuth', vi.fn(() => 1))
    vi.stubGlobal('UserProductModel', {
      getUserProducts: vi.fn().mockResolvedValue([
        { id: 1, product_id: 2, type: 'skin', name: '牛皮纸' },
      ]),
    })
    const mod = await import('../../server/api/user/products.get')
    handler = mod.default
  })

  it('should return user products', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].name).toBe('牛皮纸')
  })
})

// ══════════════════════════════════════════════════════════════
// GET /api/user/appearance
// ══════════════════════════════════════════════════════════════

describe('GET /api/user/appearance', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAuth', vi.fn(() => 1))
    vi.stubGlobal('UserAppearanceModel', {
      get: vi.fn().mockResolvedValue({
        skin_id: 2, sticker_pack_id: null, font_id: null,
        skin: { id: 2, name: '牛皮纸', asset_key: 'kraft' },
        sticker_pack: null, font: null,
      }),
    })
    const mod = await import('../../server/api/user/appearance.get')
    handler = mod.default
  })

  it('should return user appearance', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data.skin_id).toBe(2)
    expect(result.data.skin?.name).toBe('牛皮纸')
  })
})

// ══════════════════════════════════════════════════════════════
// PUT /api/user/appearance
// ══════════════════════════════════════════════════════════════

describe('PUT /api/user/appearance', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAuth', vi.fn(() => 1))
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ skin_id: 2 }))
    vi.stubGlobal('UserProductModel', {
      getOwnedIds: vi.fn().mockResolvedValue(new Set([2])),
    })
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue({ id: 2, name: '牛皮纸', is_free: 0 }),
    })
    vi.stubGlobal('UserAppearanceModel', {
      get: vi.fn().mockResolvedValue({
        skin_id: null, sticker_pack_id: null, font_id: null,
        skin: null, sticker_pack: null, font: null,
      }),
      update: vi.fn().mockResolvedValue(undefined),
    })
    const mod = await import('../../server/api/user/appearance.put')
    handler = mod.default
  })

  it('should update appearance successfully', async () => {
    // After update, get should return new state
    vi.stubGlobal('UserAppearanceModel', {
      get: vi.fn()
        .mockResolvedValueOnce({ skin_id: null, sticker_pack_id: null, font_id: null, skin: null, sticker_pack: null, font: null })
        .mockResolvedValueOnce({
          skin_id: 2, sticker_pack_id: null, font_id: null,
          skin: { id: 2, name: '牛皮纸', asset_key: 'kraft' },
          sticker_pack: null, font: null,
        }),
      update: vi.fn().mockResolvedValue(undefined),
    })
    const mod = await import('../../server/api/user/appearance.put')
    handler = mod.default
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(UserAppearanceModel.update).toHaveBeenCalledWith(1, 2, null, null)
  })

  it('should reject unowned product', async () => {
    vi.stubGlobal('UserProductModel', {
      getOwnedIds: vi.fn().mockResolvedValue(new Set()),
    })
    const mod = await import('../../server/api/user/appearance.put')
    handler = mod.default
    await expect(handler({})).rejects.toThrow('未拥有该商品')
  })

  it('should merge: only update sent fields, preserve others', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ font_id: 5 }))
    vi.stubGlobal('UserProductModel', {
      getOwnedIds: vi.fn().mockResolvedValue(new Set([2, 5])),
    })
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockImplementation((id: number) => {
        if (id === 2) return { id: 2, name: '牛皮纸', is_free: 0 }
        if (id === 5) return { id: 5, name: '字体', is_free: 0 }
        return null
      }),
    })
    vi.stubGlobal('UserAppearanceModel', {
      get: vi.fn()
        .mockResolvedValueOnce({ skin_id: 2, sticker_pack_id: null, font_id: null, skin: null, sticker_pack: null, font: null })
        .mockResolvedValueOnce({ skin_id: 2, sticker_pack_id: null, font_id: 5, skin: null, sticker_pack: null, font: null }),
      update: vi.fn().mockResolvedValue(undefined),
    })
    const mod = await import('../../server/api/user/appearance.put')
    handler = mod.default
    const result = await handler({})
    expect(result.success).toBe(true)
    // skin_id=2 preserved from current, font_id=5 from body
    expect(UserAppearanceModel.update).toHaveBeenCalledWith(1, 2, null, 5)
  })

  it('should allow clearing skin_id to null', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ skin_id: null }))
    vi.stubGlobal('UserProductModel', {
      getOwnedIds: vi.fn().mockResolvedValue(new Set([2])),
    })
    vi.stubGlobal('UserAppearanceModel', {
      get: vi.fn()
        .mockResolvedValueOnce({ skin_id: 2, sticker_pack_id: null, font_id: null, skin: null, sticker_pack: null, font: null })
        .mockResolvedValueOnce({ skin_id: null, sticker_pack_id: null, font_id: null, skin: null, sticker_pack: null, font: null }),
      update: vi.fn().mockResolvedValue(undefined),
    })
    const mod = await import('../../server/api/user/appearance.put')
    handler = mod.default
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(UserAppearanceModel.update).toHaveBeenCalledWith(1, null, null, null)
  })

  it('should reject nonexistent product', async () => {
    vi.stubGlobal('readBody', vi.fn().mockResolvedValue({ skin_id: 999 }))
    vi.stubGlobal('UserProductModel', {
      getOwnedIds: vi.fn().mockResolvedValue(new Set()),
    })
    vi.stubGlobal('ShopProductModel', {
      findById: vi.fn().mockResolvedValue(null),
    })
    vi.stubGlobal('UserAppearanceModel', {
      get: vi.fn().mockResolvedValue({ skin_id: null, sticker_pack_id: null, font_id: null, skin: null, sticker_pack: null, font: null }),
      update: vi.fn(),
    })
    const mod = await import('../../server/api/user/appearance.put')
    handler = mod.default
    await expect(handler({})).rejects.toThrow('skin_id 对应的商品不存在')
  })
})
