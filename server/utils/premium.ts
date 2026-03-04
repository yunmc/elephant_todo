import type { H3Event } from 'h3'

export interface PremiumStatus {
  isPremium: boolean
  plan: 'free' | 'premium'
  expiresAt: string | null
  autoRenew: boolean
  expired: boolean
}

/**
 * 获取用户的 Premium 状态（不报错）
 */
export async function getPremiumStatus(userId: number): Promise<PremiumStatus> {
  const [rows] = await getDb().query<any[]>(
    'SELECT plan, plan_expires_at, auto_renew FROM users WHERE id = ?',
    [userId]
  )
  const user = rows[0]
  if (!user) throw createError({ statusCode: 404, message: '用户不存在' })

  const now = new Date()
  const expiresAt = user.plan_expires_at ? new Date(user.plan_expires_at) : null
  const notExpired = expiresAt && expiresAt > now
  // auto_renew=1 时给宽限期（Apple billing retry 最多 60 天），上限 65 天防止异常
  const MAX_GRACE_PERIOD_MS = 65 * 24 * 60 * 60 * 1000
  const withinGrace = !!user.auto_renew
    && expiresAt
    && (now.getTime() - expiresAt.getTime()) < MAX_GRACE_PERIOD_MS
  const isPremium = user.plan === 'premium'
    && !!expiresAt
    && (notExpired || withinGrace)

  return {
    isPremium,
    plan: user.plan,
    expiresAt: expiresAt?.toISOString() ?? null,
    autoRenew: !!user.auto_renew,
    expired: user.plan === 'premium'
      && !!expiresAt
      && expiresAt <= now
      && !withinGrace,
  }
}

/**
 * 要求 Premium 权限，否则抛 403。
 * 用于付费功能 API 的前置校验。
 */
export async function requirePremium(userId: number): Promise<void> {
  const status = await getPremiumStatus(userId)
  if (!status.isPremium) {
    throw createError({
      statusCode: 403,
      message: 'PREMIUM_REQUIRED',
      data: { expired: status.expired },
    })
  }
}

/**
 * 要求 Admin 权限，否则抛 403。
 * 查 admin_users 表，与 App 用户无关。
 */
export async function requireAdmin(adminId: number): Promise<void> {
  const [rows] = await getDb().query<any[]>(
    'SELECT id FROM admin_users WHERE id = ?',
    [adminId]
  )
  if (!rows[0]) {
    throw createError({ statusCode: 403, message: '无权限' })
  }
}
