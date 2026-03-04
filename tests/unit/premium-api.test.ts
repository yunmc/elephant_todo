/**
 * Premium API 端点测试
 * 覆盖 GET /api/premium/status 和 POST /api/premium/activate
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('GET /api/premium/status', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('未登录返回 401', async () => {
    vi.stubGlobal('requireAuth', () => { throw createError({ statusCode: 401, message: '未登录' }) })

    const handler = (await import('../../server/api/premium/status.get')).default
    await expect(handler({} as any)).rejects.toThrow('未登录')
  })

  it('返回正确的 free 状态', async () => {
    vi.stubGlobal('requireAuth', () => 1)
    vi.stubGlobal('getPremiumStatus', vi.fn(async () => ({
      isPremium: false,
      plan: 'free',
      expiresAt: null,
      autoRenew: false,
      expired: false,
    })))

    const handler = (await import('../../server/api/premium/status.get')).default
    const result = await handler({} as any)

    expect(result.success).toBe(true)
    expect(result.data.isPremium).toBe(false)
    expect(result.data.plan).toBe('free')
  })

  it('返回正确的 premium 状态', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    vi.stubGlobal('requireAuth', () => 1)
    vi.stubGlobal('getPremiumStatus', vi.fn(async () => ({
      isPremium: true,
      plan: 'premium',
      expiresAt: future,
      autoRenew: false,
      expired: false,
    })))

    const handler = (await import('../../server/api/premium/status.get')).default
    const result = await handler({} as any)

    expect(result.success).toBe(true)
    expect(result.data.isPremium).toBe(true)
    expect(result.data.plan).toBe('premium')
    expect(result.data.expiresAt).toBe(future)
  })
})

describe('POST /api/premium/activate', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Default env = non-production (test)
    vi.stubGlobal('requireAuth', () => 1)
    vi.stubGlobal('readBody', vi.fn())
    vi.stubGlobal('UserModel', {
      updatePlan: vi.fn(),
    })
    vi.stubGlobal('getDb', () => ({ query: vi.fn() }))
  })

  it('在生产环境返回 403', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    vi.stubGlobal('readBody', vi.fn(async () => ({ plan_type: 'monthly' })))

    const handler = (await import('../../server/api/premium/activate.post')).default

    try {
      await handler({} as any)
      expect.unreachable()
    } catch (err: any) {
      expect(err.statusCode).toBe(403)
      expect(err.message).toBe('此接口仅限开发环境使用')
    } finally {
      process.env.NODE_ENV = originalEnv
    }
  })

  it('无效 plan_type 返回 400', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ plan_type: 'invalid' })))

    const handler = (await import('../../server/api/premium/activate.post')).default

    try {
      await handler({} as any)
      expect.unreachable()
    } catch (err: any) {
      expect(err.statusCode).toBe(400)
      expect(err.message).toBe('plan_type 必须为 monthly 或 yearly')
    }
  })

  it('monthly 正确设置 1 个月后到期', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ plan_type: 'monthly' })))

    const mockUpdatePlan = vi.fn()
    vi.stubGlobal('UserModel', { updatePlan: mockUpdatePlan })

    const mockDbQuery = vi.fn()
    vi.stubGlobal('getDb', () => ({ query: mockDbQuery }))

    vi.stubGlobal('getPremiumStatus', vi.fn(async () => ({
      isPremium: true,
      plan: 'premium',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: false,
      expired: false,
    })))

    const handler = (await import('../../server/api/premium/activate.post')).default
    const result = await handler({} as any)

    expect(result.success).toBe(true)
    expect(mockUpdatePlan).toHaveBeenCalledWith(1, 'premium', expect.any(Date))

    // Verify the expiration date is roughly 1 month from now
    const expiresAt = mockUpdatePlan.mock.calls[0][2] as Date
    const diffDays = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeGreaterThan(27)
    expect(diffDays).toBeLessThan(32)

    // Verify order record was inserted
    expect(mockDbQuery).toHaveBeenCalled()
    const insertCall = mockDbQuery.mock.calls[0]
    expect(insertCall[0]).toContain('INSERT INTO premium_orders')
    expect(insertCall[1]).toContain(3.00) // monthly amount
  })

  it('yearly 正确设置 1 年后到期', async () => {
    vi.stubGlobal('readBody', vi.fn(async () => ({ plan_type: 'yearly' })))

    const mockUpdatePlan = vi.fn()
    vi.stubGlobal('UserModel', { updatePlan: mockUpdatePlan })

    const mockDbQuery = vi.fn()
    vi.stubGlobal('getDb', () => ({ query: mockDbQuery }))

    vi.stubGlobal('getPremiumStatus', vi.fn(async () => ({
      isPremium: true,
      plan: 'premium',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: false,
      expired: false,
    })))

    const handler = (await import('../../server/api/premium/activate.post')).default
    const result = await handler({} as any)

    expect(result.success).toBe(true)
    expect(mockUpdatePlan).toHaveBeenCalledWith(1, 'premium', expect.any(Date))

    // Verify the expiration date is roughly 1 year from now
    const expiresAt = mockUpdatePlan.mock.calls[0][2] as Date
    const diffDays = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeGreaterThan(360)
    expect(diffDays).toBeLessThan(370)

    // Verify yearly amount
    const insertCall = mockDbQuery.mock.calls[0]
    expect(insertCall[1]).toContain(28.00) // yearly amount
  })
})
