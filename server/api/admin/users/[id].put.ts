import { AdminUserMgmtModel } from '~~/server/utils/models/admin.model'

export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: '无效用户 ID' })

  const body = await readBody(event)
  const { plan, plan_expires_at } = body || {}

  if (plan && !['free', 'premium'].includes(plan)) {
    throw createError({ statusCode: 400, message: 'plan 必须为 free 或 premium' })
  }

  if (plan) {
    await AdminUserMgmtModel.updatePlan(id, plan, plan_expires_at || null)
  }

  return { success: true, message: '用户信息已更新' }
})
