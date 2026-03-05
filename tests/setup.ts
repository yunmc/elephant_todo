/**
 * Vitest global setup — stubs Nitro auto-imports so server-side modules
 * can be imported in a plain Node environment.
 */
import { vi } from 'vitest'

// ---------- Core Nitro helpers ----------
vi.stubGlobal('createError', (opts: { statusCode: number; message: string; data?: any }) => {
  const err = new Error(opts.message) as any
  err.statusCode = opts.statusCode
  if (opts.data !== undefined) err.data = opts.data
  return err
})

vi.stubGlobal('useRuntimeConfig', () => ({
  jwtSecret: 'test-jwt-secret-key-for-testing',
  jwtExpiresIn: '1h',
  jwtRefreshSecret: 'test-jwt-refresh-secret-key-for-testing',
  jwtRefreshExpiresIn: '7d',
  resetTokenExpiresIn: '3600000',
}))

// ---------- H3 request helpers ----------
vi.stubGlobal('getHeader', vi.fn())
vi.stubGlobal('getRequestIP', vi.fn(() => '127.0.0.1'))
vi.stubGlobal('getQuery', vi.fn(() => ({})))
vi.stubGlobal('getRouterParam', vi.fn())
vi.stubGlobal('readBody', vi.fn())
vi.stubGlobal('setResponseStatus', vi.fn())
vi.stubGlobal('defineEventHandler', (fn: Function) => fn)

// ---------- App-level auto-imports ----------
vi.stubGlobal('rateLimit', vi.fn())
vi.stubGlobal('rateLimitByUser', vi.fn())
vi.stubGlobal('requireAuth', vi.fn(() => 1))
vi.stubGlobal('generateTokens', vi.fn(() => ({
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
})))

// ---------- Premium utils ----------
vi.stubGlobal('getPremiumStatus', vi.fn(async () => ({
  isPremium: false,
  plan: 'free',
  expiresAt: null,
  autoRenew: false,
  expired: false,
})))
vi.stubGlobal('requirePremium', vi.fn())
vi.stubGlobal('requireAdmin', vi.fn())

// ---------- Model stubs (overridden per-test as needed) ----------
vi.stubGlobal('UserModel', {})
vi.stubGlobal('TodoModel', {})
vi.stubGlobal('IdeaModel', {})
vi.stubGlobal('VaultModel', {})
vi.stubGlobal('FinanceCategoryModel', {})
vi.stubGlobal('FinanceRecordModel', {})
vi.stubGlobal('ImportantDateModel', {})
vi.stubGlobal('PeriodModel', {})
vi.stubGlobal('CategoryModel', {})
vi.stubGlobal('TagModel', {})
vi.stubGlobal('SubtaskModel', {})

// ---------- Shop Model stubs ----------
vi.stubGlobal('ShopProductModel', {})
vi.stubGlobal('WalletModel', {})
vi.stubGlobal('UserProductModel', {})
vi.stubGlobal('UserAppearanceModel', {})
vi.stubGlobal('purchaseProduct', vi.fn())

// ---------- Budget Model stubs ----------
vi.stubGlobal('FinanceBudgetModel', {})

// ---------- Admin stubs ----------
vi.stubGlobal('requireAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
vi.stubGlobal('requireSuperAdminAuth', vi.fn(() => ({ adminId: 1, role: 'super_admin' })))
vi.stubGlobal('generateAdminToken', vi.fn(() => 'mock-admin-token'))
vi.stubGlobal('AdminUserModel', {})
vi.stubGlobal('AdminStatsModel', {})
vi.stubGlobal('AdminUserMgmtModel', {})
vi.stubGlobal('AdminProductModel', {})
vi.stubGlobal('AdminOrderModel', {})
vi.stubGlobal('AdminActivityModel', {})

// ---------- AI stubs ----------
vi.stubGlobal('AiReportModel', {})
vi.stubGlobal('callLLM', vi.fn())
vi.stubGlobal('extractJSON', vi.fn())
vi.stubGlobal('aggregateMonthlyData', vi.fn())
vi.stubGlobal('aggregateYearlyData', vi.fn())

// ---------- Utility stubs ----------
vi.stubGlobal('sendResetPasswordEmail', vi.fn())

// ---------- DB stub (prevents real connections) ----------
vi.stubGlobal('getDb', () => ({ query: vi.fn(), select: vi.fn(() => ({ from: vi.fn() })), insert: vi.fn(), update: vi.fn(), delete: vi.fn() }))
vi.stubGlobal('getPool', () => ({ query: vi.fn(), getConnection: vi.fn() }))
