import { AdminProductModel } from '~~/server/utils/models/admin.model'

export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const query = getQuery(event)
  const page = Number(query.page) || 1
  const pageSize = Math.min(Number(query.pageSize) || 20, 100)
  const type = (query.type as string) || undefined
  const status = (query.status as string) || undefined

  const { products, total } = await AdminProductModel.listAll({ page, pageSize, type, status })

  return {
    success: true,
    data: {
      products,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
})
