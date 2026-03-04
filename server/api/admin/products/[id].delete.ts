import { AdminProductModel } from '~~/server/utils/models/admin.model'

export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: '无效商品 ID' })

  await AdminProductModel.deactivate(id)

  return { success: true, message: '商品已下架' }
})
