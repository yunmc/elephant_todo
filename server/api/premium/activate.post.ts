export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody(event)

  // 仅允许开发环境调用（生产环境由支付回调 / admin 后台处理）
  const isDev = process.env.NODE_ENV !== 'production'
  if (!isDev) {
    throw createError({ statusCode: 403, message: '此接口仅限开发环境使用' })
  }

  const planType = body.plan_type as 'monthly' | 'yearly'
  if (!['monthly', 'yearly'].includes(planType)) {
    throw createError({ statusCode: 400, message: 'plan_type 必须为 monthly 或 yearly' })
  }

  const now = new Date()
  const expiresAt = new Date(now)
  if (planType === 'monthly') {
    expiresAt.setMonth(expiresAt.getMonth() + 1)
  } else {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  }

  await UserModel.updatePlan(userId, 'premium', expiresAt)

  // 同时创建一条测试订单记录
  const orderNo = `ELP${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  await getDb().query(
    `INSERT INTO premium_orders (user_id, order_no, plan_type, amount, status, payment_method, paid_at, starts_at, expires_at)
     VALUES (?, ?, ?, ?, 'paid', 'dev_test', NOW(), NOW(), ?)`,
    [userId, orderNo, planType, planType === 'monthly' ? 3.00 : 28.00, expiresAt]
  )

  const status = await getPremiumStatus(userId)
  return {
    success: true,
    data: status,
  }
})
