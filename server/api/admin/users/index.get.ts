import { AdminUserMgmtModel } from '~~/server/utils/models/admin.model'

export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const query = getQuery(event)
  const page = Number(query.page) || 1
  const pageSize = Math.min(Number(query.pageSize) || 20, 100)
  const search = (query.search as string) || undefined
  const plan = (query.plan as string) || undefined

  const { users, total } = await AdminUserMgmtModel.list({ page, pageSize, search, plan })

  return {
    success: true,
    data: {
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
})
