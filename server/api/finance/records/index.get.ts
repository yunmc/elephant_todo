import type { FinanceQueryParams } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  const params: FinanceQueryParams = {
    type: query.type as any,
    category_id: query.category_id ? Number(query.category_id) : undefined,
    start_date: query.start_date as string,
    end_date: query.end_date as string,
    page: Math.max(1, query.page ? Number(query.page) : 1),
    limit: Math.min(Math.max(1, query.limit ? Number(query.limit) : 50), 200),
  }

  const { records, total } = await FinanceRecordModel.findByUser(userId, params)

  return {
    success: true,
    data: records,
    pagination: {
      page: params.page!,
      limit: params.limit!,
      total,
      totalPages: Math.ceil(total / params.limit!),
    },
  }
})
