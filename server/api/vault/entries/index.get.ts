import type { VaultQueryParams } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  const params: VaultQueryParams = {
    group_id: query.group_id ? Number(query.group_id) : undefined,
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 20,
  }

  const { entries, total } = await VaultModel.findEntries(userId, params)
  return {
    success: true,
    data: entries,
    pagination: {
      page: params.page!,
      limit: params.limit!,
      total,
      totalPages: Math.ceil(total / params.limit!),
    },
  }
})
