import { AdminUserMgmtModel } from '~~/server/utils/models/admin.model'

export default defineEventHandler(async (event) => {
  const { adminId } = requireAdminAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: '无效用户 ID' })

  const body = await readBody(event)
  const { amount } = body || {}

  if (!amount || typeof amount !== 'number' || amount <= 0 || amount > 10000) {
    throw createError({ statusCode: 400, message: '发放数量必须在 1-10000 之间' })
  }

  await AdminUserMgmtModel.grantCoins(id, amount, adminId)

  return { success: true, message: `已发放 ${amount} 象币` }
})
