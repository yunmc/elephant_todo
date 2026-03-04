/**
 * Premium 工具函数单元测试
 * 覆盖 getPremiumStatus / requirePremium / requireAdmin
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the actual implementation, so we need to import after stubs
// But since getPremiumStatus etc. are auto-imported, we re-define them from source
// For unit tests, we directly call the functions with mocked getDb

describe('getPremiumStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('返回 free 用户状态', async () => {
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'free',
      plan_expires_at: null,
      auto_renew: 0,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { getPremiumStatus: fn } = await import('../../server/utils/premium')
    const status = await fn(1)

    expect(status.isPremium).toBe(false)
    expect(status.plan).toBe('free')
    expect(status.expiresAt).toBeNull()
    expect(status.autoRenew).toBe(false)
    expect(status.expired).toBe(false)
  })

  it('返回有效 premium 状态', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天后
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'premium',
      plan_expires_at: future,
      auto_renew: 0,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { getPremiumStatus: fn } = await import('../../server/utils/premium')
    const status = await fn(1)

    expect(status.isPremium).toBe(true)
    expect(status.plan).toBe('premium')
    expect(status.expiresAt).toBe(future.toISOString())
    expect(status.autoRenew).toBe(false)
    expect(status.expired).toBe(false)
  })

  it('返回过期 premium 状态（auto_renew=0）', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1天前
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'premium',
      plan_expires_at: past,
      auto_renew: 0,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { getPremiumStatus: fn } = await import('../../server/utils/premium')
    const status = await fn(1)

    expect(status.isPremium).toBe(false)
    expect(status.plan).toBe('premium')
    expect(status.expired).toBe(true)
    expect(status.autoRenew).toBe(false)
  })

  it('过期但 auto_renew=1 仍为 Premium（宽限期内）', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'premium',
      plan_expires_at: past,
      auto_renew: 1,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { getPremiumStatus: fn } = await import('../../server/utils/premium')
    const status = await fn(1)

    expect(status.isPremium).toBe(true)
    expect(status.autoRenew).toBe(true)
    expect(status.expired).toBe(false) // 自动续费中不算已过期
  })

  it('过期超过65天且 auto_renew=1 不再是 Premium', async () => {
    const past = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000) // 70天前过期
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'premium',
      plan_expires_at: past,
      auto_renew: 1,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { getPremiumStatus: fn } = await import('../../server/utils/premium')
    const status = await fn(1)

    expect(status.isPremium).toBe(false)
    expect(status.autoRenew).toBe(true)
    expect(status.expired).toBe(true)
  })

  it('用户不存在时抛 404', async () => {
    const mockQuery = vi.fn().mockResolvedValue([[]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { getPremiumStatus: fn } = await import('../../server/utils/premium')

    await expect(fn(999)).rejects.toThrow('用户不存在')
  })

  it('premium 但 plan_expires_at=null 时 isPremium=false', async () => {
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'premium',
      plan_expires_at: null,
      auto_renew: 0,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { getPremiumStatus: fn } = await import('../../server/utils/premium')
    const status = await fn(1)

    expect(status.isPremium).toBe(false)
    expect(status.plan).toBe('premium')
    expect(status.expiresAt).toBeNull()
    expect(status.expired).toBe(false)
  })

  it('宽限期边界：恰好65天时仍在宽限期内', async () => {
    // < 65天 应该在宽限期内
    const past = new Date(Date.now() - 64 * 24 * 60 * 60 * 1000)
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'premium',
      plan_expires_at: past,
      auto_renew: 1,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { getPremiumStatus: fn } = await import('../../server/utils/premium')
    const status = await fn(1)

    expect(status.isPremium).toBe(true)
    expect(status.expired).toBe(false)
  })
})

describe('requirePremium', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('对 free 用户抛 403 PREMIUM_REQUIRED', async () => {
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'free',
      plan_expires_at: null,
      auto_renew: 0,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { requirePremium: fn } = await import('../../server/utils/premium')

    try {
      await fn(1)
      expect.unreachable()
    } catch (err: any) {
      expect(err.statusCode).toBe(403)
      expect(err.message).toBe('PREMIUM_REQUIRED')
    }
  })

  it('对已过期用户抛 403 且 data.expired=true', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'premium',
      plan_expires_at: past,
      auto_renew: 0,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { requirePremium: fn } = await import('../../server/utils/premium')

    try {
      await fn(1)
      expect.unreachable()
    } catch (err: any) {
      expect(err.statusCode).toBe(403)
      expect(err.message).toBe('PREMIUM_REQUIRED')
      expect(err.data.expired).toBe(true)
    }
  })

  it('对 free 用户抛 403 且 data.expired=false', async () => {
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'free',
      plan_expires_at: null,
      auto_renew: 0,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { requirePremium: fn } = await import('../../server/utils/premium')

    try {
      await fn(1)
      expect.unreachable()
    } catch (err: any) {
      expect(err.statusCode).toBe(403)
      expect(err.data.expired).toBe(false)
    }
  })

  it('对有效 premium 用户不报错', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'premium',
      plan_expires_at: future,
      auto_renew: 0,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { requirePremium: fn } = await import('../../server/utils/premium')

    await expect(fn(1)).resolves.toBeUndefined()
  })

  it('对过期但 auto_renew=1 的用户不报错', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const mockQuery = vi.fn().mockResolvedValue([[{
      plan: 'premium',
      plan_expires_at: past,
      auto_renew: 1,
    }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { requirePremium: fn } = await import('../../server/utils/premium')

    await expect(fn(1)).resolves.toBeUndefined()
  })
})

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('对不存在的 adminId 抛 403', async () => {
    const mockQuery = vi.fn().mockResolvedValue([[]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { requireAdmin: fn } = await import('../../server/utils/premium')

    try {
      await fn(999)
      expect.unreachable()
    } catch (err: any) {
      expect(err.statusCode).toBe(403)
      expect(err.message).toBe('无权限')
    }
  })

  it('对有效 adminId 不报错', async () => {
    const mockQuery = vi.fn().mockResolvedValue([[{ id: 1 }]])
    vi.stubGlobal('getDb', () => ({ query: mockQuery }))

    const { requireAdmin: fn } = await import('../../server/utils/premium')

    await expect(fn(1)).resolves.toBeUndefined()
  })
})
