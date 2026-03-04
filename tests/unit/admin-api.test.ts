/**
 * Admin API Endpoint Unit Tests
 *
 * Tests all admin API handlers: auth, stats, users, products, orders, activities.
 * Strict assertions — every field checked for exact value or type.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ══════════════════════════════════════════════════════════════
// Admin Auth — POST /api/admin/auth/login
// ══════════════════════════════════════════════════════════════

describe('Admin Auth — Login', () => {
  let handler: Function

  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal('readBody', vi.fn(() => ({ username: 'admin', password: '123456' })))
    vi.stubGlobal('AdminUserModel', {
      findByUsername: vi.fn().mockResolvedValue({
        id: 1,
        username: 'admin',
        email: 'admin@elephant.app',
        password: '$2a$10$hashedpassword',
        role: 'super_admin',
      }),
      updateLastLogin: vi.fn(),
    })
    vi.stubGlobal('generateAdminToken', vi.fn(() => 'mock-admin-jwt'))

    vi.doMock('bcryptjs', () => ({
      default: { compare: vi.fn().mockResolvedValue(true) },
    }))

    const mod = await import('../../server/api/admin/auth/login.post')
    handler = mod.default
  })

  it('should return token and admin info on valid credentials', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data.token).toBe('mock-admin-jwt')
    expect(result.data.admin).toStrictEqual({
      id: 1,
      username: 'admin',
      email: 'admin@elephant.app',
      role: 'super_admin',
    })
    expect(AdminUserModel.updateLastLogin).toHaveBeenCalledWith(1)
  })

  it('should reject missing username', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ password: '123456' })))
    vi.resetModules()
    vi.doMock('bcryptjs', () => ({ default: { compare: vi.fn() } }))
    const mod = await import('../../server/api/admin/auth/login.post')
    await expect(mod.default({})).rejects.toThrow('请输入用户名和密码')
  })

  it('should reject missing password', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ username: 'admin' })))
    vi.resetModules()
    vi.doMock('bcryptjs', () => ({ default: { compare: vi.fn() } }))
    const mod = await import('../../server/api/admin/auth/login.post')
    await expect(mod.default({})).rejects.toThrow('请输入用户名和密码')
  })

  it('should reject empty body', async () => {
    vi.stubGlobal('readBody', vi.fn(() => null))
    vi.resetModules()
    vi.doMock('bcryptjs', () => ({ default: { compare: vi.fn() } }))
    const mod = await import('../../server/api/admin/auth/login.post')
    await expect(mod.default({})).rejects.toThrow('请输入用户名和密码')
  })

  it('should reject non-existent admin', async () => {
    vi.stubGlobal('AdminUserModel', {
      findByUsername: vi.fn().mockResolvedValue(null),
      updateLastLogin: vi.fn(),
    })
    vi.resetModules()
    vi.doMock('bcryptjs', () => ({ default: { compare: vi.fn() } }))
    const mod = await import('../../server/api/admin/auth/login.post')
    await expect(mod.default({})).rejects.toThrow('用户名或密码错误')
  })

  it('should reject wrong password', async () => {
    vi.resetModules()
    vi.doMock('bcryptjs', () => ({
      default: { compare: vi.fn().mockResolvedValue(false) },
    }))
    const mod = await import('../../server/api/admin/auth/login.post')
    await expect(mod.default({})).rejects.toThrow('用户名或密码错误')
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Auth — GET /api/admin/auth/me
// ══════════════════════════════════════════════════════════════

describe('Admin Auth — Me', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('AdminUserModel', {
      findById: vi.fn().mockResolvedValue({
        id: 1,
        username: 'admin',
        email: 'admin@elephant.app',
        role: 'super_admin',
        last_login_at: new Date('2026-01-01'),
        created_at: new Date('2025-01-01'),
      }),
    })
    const mod = await import('../../server/api/admin/auth/me.get')
    handler = mod.default
  })

  it('should return current admin profile with exact fields', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data).toStrictEqual({
      id: 1,
      username: 'admin',
      email: 'admin@elephant.app',
      role: 'super_admin',
      last_login_at: new Date('2026-01-01'),
      created_at: new Date('2025-01-01'),
    })
  })

  it('should throw 401 if admin not found in DB', async () => {
    vi.stubGlobal('AdminUserModel', {
      findById: vi.fn().mockResolvedValue(null),
    })
    const mod = await import('../../server/api/admin/auth/me.get')
    await expect(mod.default({})).rejects.toThrow('管理员账号不存在')
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Auth — POST /api/admin/auth/logout
// ══════════════════════════════════════════════════════════════

describe('Admin Auth — Logout', () => {
  it('should return success (stateless)', async () => {
    const mod = await import('../../server/api/admin/auth/logout.post')
    const result = await mod.default({})
    expect(result).toStrictEqual({ success: true, message: '已退出登录' })
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Stats — GET /api/admin/stats/overview
// ══════════════════════════════════════════════════════════════

describe('Admin Stats — Overview', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('AdminStatsModel', {
      totalUsers: vi.fn().mockResolvedValue(100),
      premiumUsers: vi.fn().mockResolvedValue(25),
      todayRegistrations: vi.fn().mockResolvedValue(5),
      todayActiveUsers: vi.fn().mockResolvedValue(30),
      totalRevenue: vi.fn().mockResolvedValue({ premiumRevenue: 5000, shopRevenue: 1200 }),
      moduleUsage: vi.fn().mockResolvedValue({
        todos: 500, ideas: 200, finance: 150,
        vault: 80, important_dates: 60, period: 40,
      }),
    })
    const mod = await import('../../server/api/admin/stats/overview.get')
    handler = mod.default
  })

  it('should return all stats with computed conversionRate', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    const d = result.data
    expect(d.totalUsers).toBe(100)
    expect(d.premiumUsers).toBe(25)
    expect(d.todayNew).toBe(5)
    expect(d.todayActive).toBe(30)
    expect(d.conversionRate).toBe(25.0)
    expect(d.revenue).toStrictEqual({ premiumRevenue: 5000, shopRevenue: 1200 })
    expect(d.moduleUsage).toStrictEqual({
      todos: 500, ideas: 200, finance: 150,
      vault: 80, important_dates: 60, period: 40,
    })
  })

  it('should return conversionRate 0 when totalUsers is 0', async () => {
    vi.stubGlobal('AdminStatsModel', {
      totalUsers: vi.fn().mockResolvedValue(0),
      premiumUsers: vi.fn().mockResolvedValue(0),
      todayRegistrations: vi.fn().mockResolvedValue(0),
      todayActiveUsers: vi.fn().mockResolvedValue(0),
      totalRevenue: vi.fn().mockResolvedValue({ premiumRevenue: 0, shopRevenue: 0 }),
      moduleUsage: vi.fn().mockResolvedValue({}),
    })
    const result = await handler({})
    expect(result.data.conversionRate).toBe(0)
    expect(result.data.totalUsers).toBe(0)
    expect(result.data.premiumUsers).toBe(0)
  })

  it('should compute fractional conversionRate correctly (33.3%)', async () => {
    vi.stubGlobal('AdminStatsModel', {
      totalUsers: vi.fn().mockResolvedValue(3),
      premiumUsers: vi.fn().mockResolvedValue(1),
      todayRegistrations: vi.fn().mockResolvedValue(0),
      todayActiveUsers: vi.fn().mockResolvedValue(0),
      totalRevenue: vi.fn().mockResolvedValue({ premiumRevenue: 0, shopRevenue: 0 }),
      moduleUsage: vi.fn().mockResolvedValue({}),
    })
    const result = await handler({})
    expect(result.data.conversionRate).toBe(33.3)
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Stats — GET /api/admin/stats/trend
// ══════════════════════════════════════════════════════════════

describe('Admin Stats — Trend', () => {
  let handler: Function
  const mockTrend = [
    { date: '2026-02-27', count: 3 },
    { date: '2026-02-28', count: 5 },
    { date: '2026-03-01', count: 2 },
  ]

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getQuery', vi.fn(() => ({})))
    vi.stubGlobal('AdminStatsModel', {
      registrationTrend: vi.fn().mockResolvedValue(mockTrend),
    })
    const mod = await import('../../server/api/admin/stats/trend.get')
    handler = mod.default
  })

  it('should return trend data defaulting to 30 days', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data).toStrictEqual(mockTrend)
    expect(AdminStatsModel.registrationTrend).toHaveBeenCalledWith(30)
  })

  it('should pass custom days param', async () => {
    vi.stubGlobal('getQuery', vi.fn(() => ({ days: '7' })))
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(AdminStatsModel.registrationTrend).toHaveBeenCalledWith(7)
  })

  it('should default to 30 when days is not a number', async () => {
    vi.stubGlobal('getQuery', vi.fn(() => ({ days: 'abc' })))
    await handler({})
    expect(AdminStatsModel.registrationTrend).toHaveBeenCalledWith(30)
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Stats — GET /api/admin/stats/products
// ══════════════════════════════════════════════════════════════

describe('Admin Stats — Top Products', () => {
  let handler: Function
  const mockProducts = [
    { id: 1, name: '牛皮纸', type: 'skin', sold: 50, revenue: 1000 },
    { id: 2, name: '手写体', type: 'font', sold: 30, revenue: 600 },
  ]

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getQuery', vi.fn(() => ({})))
    vi.stubGlobal('AdminStatsModel', {
      topProducts: vi.fn().mockResolvedValue(mockProducts),
    })
    const mod = await import('../../server/api/admin/stats/products.get')
    handler = mod.default
  })

  it('should return top products with default limit 10', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data).toStrictEqual(mockProducts)
    expect(AdminStatsModel.topProducts).toHaveBeenCalledWith(10)
  })

  it('should pass custom limit param', async () => {
    vi.stubGlobal('getQuery', vi.fn(() => ({ limit: '5' })))
    await handler({})
    expect(AdminStatsModel.topProducts).toHaveBeenCalledWith(5)
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Users — GET /api/admin/users
// ══════════════════════════════════════════════════════════════

describe('Admin Users — List', () => {
  let handler: Function
  const mockUsers = [
    { id: 1, username: 'alice', email: 'alice@test.com', plan: 'premium' },
    { id: 2, username: 'bob', email: 'bob@test.com', plan: 'free' },
  ]

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getQuery', vi.fn(() => ({})))
    vi.stubGlobal('AdminUserMgmtModel', {
      list: vi.fn().mockResolvedValue({ users: mockUsers, total: 2 }),
    })
    const mod = await import('../../server/api/admin/users/index.get')
    handler = mod.default
  })

  it('should return user list with pagination info', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data.users).toStrictEqual(mockUsers)
    expect(result.data.total).toBe(2)
    expect(result.data.page).toBe(1)
    expect(result.data.pageSize).toBe(20)
    expect(result.data.totalPages).toBe(1)
  })

  it('should pass search and plan filters', async () => {
    vi.stubGlobal('getQuery', vi.fn(() => ({ search: 'alice', plan: 'premium', page: '2', pageSize: '10' })))
    await handler({})
    expect(AdminUserMgmtModel.list).toHaveBeenCalledWith({
      page: 2, pageSize: 10, search: 'alice', plan: 'premium',
    })
  })

  it('should cap pageSize at 100', async () => {
    vi.stubGlobal('getQuery', vi.fn(() => ({ pageSize: '200' })))
    await handler({})
    expect(AdminUserMgmtModel.list).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 100 }),
    )
  })

  it('should compute totalPages correctly (45/10=5)', async () => {
    vi.stubGlobal('AdminUserMgmtModel', {
      list: vi.fn().mockResolvedValue({ users: [], total: 45 }),
    })
    vi.stubGlobal('getQuery', vi.fn(() => ({ pageSize: '10' })))
    const result = await handler({})
    expect(result.data.totalPages).toBe(5)
    expect(result.data.total).toBe(45)
    expect(result.data.pageSize).toBe(10)
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Users — GET /api/admin/users/:id
// ══════════════════════════════════════════════════════════════

describe('Admin Users — Detail', () => {
  let handler: Function
  const mockUser = {
    id: 5, username: 'alice', email: 'alice@test.com', plan: 'premium',
    plan_expires_at: new Date('2027-01-01'), created_at: new Date('2025-06-15'),
    coin_balance: 100, todo_count: 20, idea_count: 10, finance_count: 5,
  }

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getRouterParam', vi.fn(() => '5'))
    vi.stubGlobal('AdminUserMgmtModel', {
      detail: vi.fn().mockResolvedValue(mockUser),
    })
    const mod = await import('../../server/api/admin/users/[id].get')
    handler = mod.default
  })

  it('should return user detail with exact fields', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data).toStrictEqual(mockUser)
    expect(result.data.id).toBe(5)
    expect(result.data.username).toBe('alice')
    expect(result.data.coin_balance).toBe(100)
    expect(result.data.todo_count).toBe(20)
  })

  it('should reject invalid user ID (NaN)', async () => {
    vi.stubGlobal('getRouterParam', vi.fn(() => 'abc'))
    await expect(handler({})).rejects.toThrow('无效用户 ID')
  })

  it('should return 404 for non-existent user', async () => {
    vi.stubGlobal('AdminUserMgmtModel', { detail: vi.fn().mockResolvedValue(null) })
    await expect(handler({})).rejects.toThrow('用户不存在')
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Users — PUT /api/admin/users/:id
// ══════════════════════════════════════════════════════════════

describe('Admin Users — Update Plan', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getRouterParam', vi.fn(() => '5'))
    vi.stubGlobal('readBody', vi.fn(() => ({ plan: 'premium', plan_expires_at: '2027-12-31' })))
    vi.stubGlobal('AdminUserMgmtModel', {
      updatePlan: vi.fn(),
    })
    const mod = await import('../../server/api/admin/users/[id].put')
    handler = mod.default
  })

  it('should update user plan with expiry date', async () => {
    const result = await handler({})
    expect(result).toStrictEqual({ success: true, message: '用户信息已更新' })
    expect(AdminUserMgmtModel.updatePlan).toHaveBeenCalledWith(5, 'premium', '2027-12-31')
  })

  it('should set expiry to null when not provided', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ plan: 'free' })))
    await handler({})
    expect(AdminUserMgmtModel.updatePlan).toHaveBeenCalledWith(5, 'free', null)
  })

  it('should reject invalid plan value', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ plan: 'vip' })))
    await expect(handler({})).rejects.toThrow('plan 必须为 free 或 premium')
  })

  it('should reject invalid user ID (zero)', async () => {
    vi.stubGlobal('getRouterParam', vi.fn(() => '0'))
    await expect(handler({})).rejects.toThrow('无效用户 ID')
  })

  it('should succeed with empty body (no-op)', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({})))
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(AdminUserMgmtModel.updatePlan).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Users — POST /api/admin/users/:id/grant-coins
// ══════════════════════════════════════════════════════════════

describe('Admin Users — Grant Coins', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 99, role: 'super_admin' })))
    vi.stubGlobal('getRouterParam', vi.fn(() => '5'))
    vi.stubGlobal('readBody', vi.fn(() => ({ amount: 500 })))
    vi.stubGlobal('AdminUserMgmtModel', {
      grantCoins: vi.fn(),
    })
    const mod = await import('../../server/api/admin/users/[id]/grant-coins.post')
    handler = mod.default
  })

  it('should grant coins passing adminId to model', async () => {
    const result = await handler({})
    expect(result).toStrictEqual({ success: true, message: '已发放 500 象币' })
    expect(AdminUserMgmtModel.grantCoins).toHaveBeenCalledWith(5, 500, 99)
  })

  it('should reject zero amount', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ amount: 0 })))
    await expect(handler({})).rejects.toThrow('发放数量必须在 1-10000 之间')
  })

  it('should reject negative amount', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ amount: -10 })))
    await expect(handler({})).rejects.toThrow('发放数量必须在 1-10000 之间')
  })

  it('should reject amount over 10000', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ amount: 10001 })))
    await expect(handler({})).rejects.toThrow('发放数量必须在 1-10000 之间')
  })

  it('should reject non-number amount', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ amount: 'abc' })))
    await expect(handler({})).rejects.toThrow('发放数量必须在 1-10000 之间')
  })

  it('should reject missing amount', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({})))
    await expect(handler({})).rejects.toThrow('发放数量必须在 1-10000 之间')
  })

  it('should reject invalid user ID', async () => {
    vi.stubGlobal('getRouterParam', vi.fn(() => 'x'))
    await expect(handler({})).rejects.toThrow('无效用户 ID')
  })

  it('should accept boundary value 1', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ amount: 1 })))
    const result = await handler({})
    expect(result).toStrictEqual({ success: true, message: '已发放 1 象币' })
    expect(AdminUserMgmtModel.grantCoins).toHaveBeenCalledWith(5, 1, 99)
  })

  it('should accept boundary value 10000', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ amount: 10000 })))
    const result = await handler({})
    expect(result).toStrictEqual({ success: true, message: '已发放 10000 象币' })
    expect(AdminUserMgmtModel.grantCoins).toHaveBeenCalledWith(5, 10000, 99)
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Products — GET /api/admin/products
// ══════════════════════════════════════════════════════════════

describe('Admin Products — List', () => {
  let handler: Function
  const mockProducts = [
    { id: 1, name: '默认', type: 'skin', status: 'active', sold_count: 100 },
    { id: 2, name: '牛皮纸', type: 'skin', status: 'inactive', sold_count: 50 },
  ]

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getQuery', vi.fn(() => ({})))
    vi.stubGlobal('AdminProductModel', {
      listAll: vi.fn().mockResolvedValue({ products: mockProducts, total: 2 }),
    })
    const mod = await import('../../server/api/admin/products/index.get')
    handler = mod.default
  })

  it('should return products with pagination', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data.products).toStrictEqual(mockProducts)
    expect(result.data.total).toBe(2)
    expect(result.data.page).toBe(1)
    expect(result.data.pageSize).toBe(20)
    expect(result.data.totalPages).toBe(1)
  })

  it('should pass type and status filters', async () => {
    vi.stubGlobal('getQuery', vi.fn(() => ({ type: 'font', status: 'active' })))
    await handler({})
    expect(AdminProductModel.listAll).toHaveBeenCalledWith({
      page: 1, pageSize: 20, type: 'font', status: 'active',
    })
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Products — POST /api/admin/products
// ══════════════════════════════════════════════════════════════

describe('Admin Products — Create', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('readBody', vi.fn(() => ({
      name: '新皮肤', type: 'skin', price: 30,
      description: '描述', preview_url: 'https://img.com/1.png',
      css_class: 'skin-new', is_free: false, sort_order: 5,
    })))
    vi.stubGlobal('AdminProductModel', {
      create: vi.fn().mockResolvedValue(42),
    })
    const mod = await import('../../server/api/admin/products/index.post')
    handler = mod.default
  })

  it('should create product and return id', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data).toStrictEqual({ id: 42 })
    expect(result.message).toBe('商品创建成功')
    expect(AdminProductModel.create).toHaveBeenCalledWith({
      name: '新皮肤', type: 'skin', price: 30,
      description: '描述', preview_url: 'https://img.com/1.png',
      css_class: 'skin-new', is_free: false, sort_order: 5,
    })
  })

  it('should reject missing name', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ type: 'skin', price: 10 })))
    await expect(handler({})).rejects.toThrow('请填写商品名称、类型和价格')
  })

  it('should reject missing type', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ name: 'X', price: 10 })))
    await expect(handler({})).rejects.toThrow('请填写商品名称、类型和价格')
  })

  it('should reject missing price (undefined)', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ name: 'X', type: 'skin' })))
    await expect(handler({})).rejects.toThrow('请填写商品名称、类型和价格')
  })

  it('should accept price = 0 (free product)', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ name: 'Free', type: 'skin', price: 0 })))
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(AdminProductModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ price: 0 }),
    )
  })

  it('should reject invalid product type', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ name: 'X', type: 'weapon', price: 10 })))
    await expect(handler({})).rejects.toThrow('无效的商品类型')
  })

  it('should accept all valid types: skin, font, sticker, bundle', async () => {
    for (const type of ['skin', 'font', 'sticker', 'bundle']) {
      vi.stubGlobal('readBody', vi.fn(() => ({ name: 'X', type, price: 10 })))
      vi.stubGlobal('AdminProductModel', { create: vi.fn().mockResolvedValue(1) })
      const result = await handler({})
      expect(result.success).toBe(true)
    }
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Products — PUT /api/admin/products/:id
// ══════════════════════════════════════════════════════════════

describe('Admin Products — Update', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getRouterParam', vi.fn(() => '3'))
    vi.stubGlobal('readBody', vi.fn(() => ({ name: '更新名称', price: 50, status: 'active' })))
    vi.stubGlobal('AdminProductModel', {
      update: vi.fn(),
    })
    const mod = await import('../../server/api/admin/products/[id].put')
    handler = mod.default
  })

  it('should update product fields', async () => {
    const result = await handler({})
    expect(result).toStrictEqual({ success: true, message: '商品已更新' })
    expect(AdminProductModel.update).toHaveBeenCalledWith(3, {
      name: '更新名称',
      price: 50,
      status: 'active',
      sort_order: undefined,
      description: undefined,
    })
  })

  it('should convert string price to number', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ price: '25' })))
    await handler({})
    expect(AdminProductModel.update).toHaveBeenCalledWith(3, expect.objectContaining({ price: 25 }))
  })

  it('should reject invalid product ID (zero)', async () => {
    vi.stubGlobal('getRouterParam', vi.fn(() => '0'))
    await expect(handler({})).rejects.toThrow('无效商品 ID')
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Products — DELETE /api/admin/products/:id
// ══════════════════════════════════════════════════════════════

describe('Admin Products — Deactivate', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getRouterParam', vi.fn(() => '3'))
    vi.stubGlobal('AdminProductModel', {
      deactivate: vi.fn(),
    })
    const mod = await import('../../server/api/admin/products/[id].delete')
    handler = mod.default
  })

  it('should deactivate product (soft delete)', async () => {
    const result = await handler({})
    expect(result).toStrictEqual({ success: true, message: '商品已下架' })
    expect(AdminProductModel.deactivate).toHaveBeenCalledWith(3)
  })

  it('should reject invalid product ID (NaN)', async () => {
    vi.stubGlobal('getRouterParam', vi.fn(() => 'bad'))
    await expect(handler({})).rejects.toThrow('无效商品 ID')
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Orders — GET /api/admin/orders
// ══════════════════════════════════════════════════════════════

describe('Admin Orders — List', () => {
  let handler: Function
  const mockOrders = [
    { id: 1, order_no: 'ORD001', user_id: 1, username: 'alice', amount: 99, status: 'paid' },
    { id: 2, order_no: 'ORD002', user_id: 2, username: 'bob', amount: 199, status: 'pending' },
  ]
  const mockPurchases = [
    { id: 1, user_id: 1, username: 'alice', product_name: '牛皮纸', product_type: 'skin' },
  ]

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getQuery', vi.fn(() => ({})))
    vi.stubGlobal('AdminOrderModel', {
      premiumOrders: vi.fn().mockResolvedValue({ orders: mockOrders, total: 2 }),
      productPurchases: vi.fn().mockResolvedValue({ purchases: mockPurchases, total: 1 }),
    })
    const mod = await import('../../server/api/admin/orders/index.get')
    handler = mod.default
  })

  it('should default to premium orders tab', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data.items).toStrictEqual(mockOrders)
    expect(result.data.total).toBe(2)
    expect(result.data.page).toBe(1)
    expect(result.data.pageSize).toBe(20)
    expect(result.data.totalPages).toBe(1)
    expect(AdminOrderModel.premiumOrders).toHaveBeenCalled()
    expect(AdminOrderModel.productPurchases).not.toHaveBeenCalled()
  })

  it('should return product purchases when tab=purchases', async () => {
    vi.stubGlobal('getQuery', vi.fn(() => ({ tab: 'purchases' })))
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data.items).toStrictEqual(mockPurchases)
    expect(result.data.total).toBe(1)
    expect(AdminOrderModel.productPurchases).toHaveBeenCalled()
    expect(AdminOrderModel.premiumOrders).not.toHaveBeenCalled()
  })

  it('should pass status filter to premium orders', async () => {
    vi.stubGlobal('getQuery', vi.fn(() => ({ status: 'paid' })))
    await handler({})
    expect(AdminOrderModel.premiumOrders).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paid' }),
    )
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Activities — GET /api/admin/activities
// ══════════════════════════════════════════════════════════════

describe('Admin Activities — List', () => {
  let handler: Function
  const mockActivities = [
    { id: 1, title: '签到送币', type: 'sign_in_bonus', status: 'active', starts_at: '2026-01-01', ends_at: '2026-12-31' },
    { id: 2, title: '春节活动', type: 'holiday_event', status: 'draft', starts_at: '2026-01-25', ends_at: '2026-02-05' },
  ]

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getQuery', vi.fn(() => ({})))
    vi.stubGlobal('AdminActivityModel', {
      list: vi.fn().mockResolvedValue({ activities: mockActivities, total: 2 }),
    })
    const mod = await import('../../server/api/admin/activities/index.get')
    handler = mod.default
  })

  it('should return activities with pagination', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data.activities).toStrictEqual(mockActivities)
    expect(result.data.total).toBe(2)
    expect(result.data.page).toBe(1)
    expect(result.data.pageSize).toBe(20)
    expect(result.data.totalPages).toBe(1)
  })

  it('should pass status filter', async () => {
    vi.stubGlobal('getQuery', vi.fn(() => ({ status: 'active' })))
    await handler({})
    expect(AdminActivityModel.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
    )
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Activities — POST /api/admin/activities
// ══════════════════════════════════════════════════════════════

describe('Admin Activities — Create', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 7, role: 'super_admin' })))
    vi.stubGlobal('readBody', vi.fn(() => ({
      title: '新活动', type: 'flash_sale',
      starts_at: '2026-03-10', ends_at: '2026-03-20',
      description: '限时优惠', config: { discount: 50 },
    })))
    vi.stubGlobal('AdminActivityModel', {
      create: vi.fn().mockResolvedValue(10),
    })
    const mod = await import('../../server/api/admin/activities/index.post')
    handler = mod.default
  })

  it('should create activity with created_by from JWT', async () => {
    const result = await handler({})
    expect(result.success).toBe(true)
    expect(result.data).toStrictEqual({ id: 10 })
    expect(result.message).toBe('活动创建成功')
    expect(AdminActivityModel.create).toHaveBeenCalledWith({
      title: '新活动', type: 'flash_sale',
      starts_at: '2026-03-10', ends_at: '2026-03-20',
      description: '限时优惠', config: { discount: 50 },
      created_by: 7,
    })
  })

  it('should reject missing title', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ type: 'custom', starts_at: '2026-01-01', ends_at: '2026-01-02' })))
    await expect(handler({})).rejects.toThrow('请填写活动标题、类型、开始和结束时间')
  })

  it('should reject missing type', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ title: 'X', starts_at: '2026-01-01', ends_at: '2026-01-02' })))
    await expect(handler({})).rejects.toThrow('请填写活动标题、类型、开始和结束时间')
  })

  it('should reject missing dates', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({ title: 'X', type: 'custom' })))
    await expect(handler({})).rejects.toThrow('请填写活动标题、类型、开始和结束时间')
  })

  it('should reject invalid activity type', async () => {
    vi.stubGlobal('readBody', vi.fn(() => ({
      title: 'X', type: 'unknown', starts_at: '2026-01-01', ends_at: '2026-01-02',
    })))
    await expect(handler({})).rejects.toThrow('无效的活动类型')
  })

  it('should accept all valid activity types', async () => {
    for (const type of ['sign_in_bonus', 'holiday_event', 'flash_sale', 'custom']) {
      vi.stubGlobal('readBody', vi.fn(() => ({
        title: 'X', type, starts_at: '2026-01-01', ends_at: '2026-01-02',
      })))
      vi.stubGlobal('AdminActivityModel', { create: vi.fn().mockResolvedValue(1) })
      const result = await handler({})
      expect(result.success).toBe(true)
    }
  })

  it('should reject null body', async () => {
    vi.stubGlobal('readBody', vi.fn(() => null))
    await expect(handler({})).rejects.toThrow('请填写活动标题、类型、开始和结束时间')
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Activities — PUT /api/admin/activities/:id
// ══════════════════════════════════════════════════════════════

describe('Admin Activities — Update', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getRouterParam', vi.fn(() => '3'))
    vi.stubGlobal('readBody', vi.fn(() => ({
      title: '改名活动', status: 'active',
      starts_at: '2026-04-01', ends_at: '2026-04-30',
    })))
    vi.stubGlobal('AdminActivityModel', {
      update: vi.fn(),
    })
    const mod = await import('../../server/api/admin/activities/[id].put')
    handler = mod.default
  })

  it('should update activity fields exactly', async () => {
    const result = await handler({})
    expect(result).toStrictEqual({ success: true, message: '活动已更新' })
    expect(AdminActivityModel.update).toHaveBeenCalledWith(3, {
      title: '改名活动',
      type: undefined,
      description: undefined,
      config: undefined,
      starts_at: '2026-04-01',
      ends_at: '2026-04-30',
      status: 'active',
    })
  })

  it('should reject invalid activity ID (zero)', async () => {
    vi.stubGlobal('getRouterParam', vi.fn(() => '0'))
    await expect(handler({})).rejects.toThrow('无效活动 ID')
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Activities — DELETE /api/admin/activities/:id
// ══════════════════════════════════════════════════════════════

describe('Admin Activities — Delete', () => {
  let handler: Function

  beforeEach(async () => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
    vi.stubGlobal('getRouterParam', vi.fn(() => '3'))
    vi.stubGlobal('AdminActivityModel', {
      delete: vi.fn(),
    })
    const mod = await import('../../server/api/admin/activities/[id].delete')
    handler = mod.default
  })

  it('should delete activity', async () => {
    const result = await handler({})
    expect(result).toStrictEqual({ success: true, message: '活动已删除' })
    expect(AdminActivityModel.delete).toHaveBeenCalledWith(3)
  })

  it('should reject invalid activity ID (NaN)', async () => {
    vi.stubGlobal('getRouterParam', vi.fn(() => 'abc'))
    await expect(handler({})).rejects.toThrow('无效活动 ID')
  })
})

// ══════════════════════════════════════════════════════════════
// Admin Auth Guard — all protected endpoints reject 401
// ══════════════════════════════════════════════════════════════

describe('Admin Auth Guard — all endpoints require auth', () => {
  beforeEach(() => {
    vi.stubGlobal('requireAdminAuth', vi.fn(() => {
      throw createError({ statusCode: 401, message: '未提供管理员认证令牌' })
    }))
    vi.stubGlobal('getQuery', vi.fn(() => ({})))
    vi.stubGlobal('getRouterParam', vi.fn(() => '1'))
    vi.stubGlobal('readBody', vi.fn(() => ({})))
  })

  const protectedEndpoints = [
    { path: '../../server/api/admin/auth/me.get', name: 'GET me' },
    { path: '../../server/api/admin/stats/overview.get', name: 'GET stats/overview' },
    { path: '../../server/api/admin/stats/trend.get', name: 'GET stats/trend' },
    { path: '../../server/api/admin/stats/products.get', name: 'GET stats/products' },
    { path: '../../server/api/admin/users/index.get', name: 'GET users' },
    { path: '../../server/api/admin/users/[id].get', name: 'GET users/:id' },
    { path: '../../server/api/admin/users/[id].put', name: 'PUT users/:id' },
    { path: '../../server/api/admin/users/[id]/grant-coins.post', name: 'POST users/:id/grant-coins' },
    { path: '../../server/api/admin/products/index.get', name: 'GET products' },
    { path: '../../server/api/admin/products/index.post', name: 'POST products' },
    { path: '../../server/api/admin/products/[id].put', name: 'PUT products/:id' },
    { path: '../../server/api/admin/products/[id].delete', name: 'DELETE products/:id' },
    { path: '../../server/api/admin/orders/index.get', name: 'GET orders' },
    { path: '../../server/api/admin/activities/index.get', name: 'GET activities' },
    { path: '../../server/api/admin/activities/index.post', name: 'POST activities' },
    { path: '../../server/api/admin/activities/[id].put', name: 'PUT activities/:id' },
    { path: '../../server/api/admin/activities/[id].delete', name: 'DELETE activities/:id' },
  ]

  for (const ep of protectedEndpoints) {
    it(`${ep.name} should reject unauthenticated request`, async () => {
      const mod = await import(ep.path)
      await expect(mod.default({})).rejects.toThrow('未提供管理员认证令牌')
    })
  }
})
