import type { IdeaQueryParams } from '~~/server/types'

const VALID_SOURCES = ['text', 'voice']
const VALID_LINKED = ['true', 'false']

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  const params: IdeaQueryParams = {
    linked: VALID_LINKED.includes(query.linked as string) ? query.linked as any : undefined,
    source: VALID_SOURCES.includes(query.source as string) ? query.source as any : undefined,
    search: query.search ? String(query.search).slice(0, 100) : undefined,
    page: Math.max(1, query.page ? Number(query.page) : 1),
    limit: Math.min(Math.max(1, query.limit ? Number(query.limit) : 20), 100),
  }

  const { ideas, total } = await IdeaModel.findByUser(userId, params)

  return {
    success: true,
    data: ideas,
    pagination: {
      page: params.page!,
      limit: params.limit!,
      total,
      totalPages: Math.ceil(total / params.limit!),
    },
  }
})
