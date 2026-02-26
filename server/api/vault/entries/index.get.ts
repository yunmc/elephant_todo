import type { VaultQueryParams } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  const params: VaultQueryParams = {
    group_id: query.group_id ? Number(query.group_id) : undefined,
    search: query.search ? String(query.search).slice(0, 100) : undefined,
    page: Math.max(1, query.page ? Number(query.page) : 1),
    limit: Math.min(Math.max(1, query.limit ? Number(query.limit) : 20), 100),
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
