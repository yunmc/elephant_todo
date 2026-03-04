import { AdminStatsModel } from '~~/server/utils/models/admin.model'

export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const query = getQuery(event)
  const limit = Number(query.limit) || 10

  const products = await AdminStatsModel.topProducts(limit)

  return { success: true, data: products }
})
