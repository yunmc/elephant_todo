
export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const query = getQuery(event)
  const page = Number(query.page) || 1
  const pageSize = Math.min(Number(query.pageSize) || 20, 100)
  const status = (query.status as string) || undefined

  const { activities, total } = await AdminActivityModel.list({ page, pageSize, status })

  return {
    success: true,
    data: {
      activities,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  }
})
