import type { IdeaQueryParams } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  const params: IdeaQueryParams = {
    linked: query.linked as any,
    source: query.source as any,
    search: query.search as string,
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 20,
  }

  const { ideas, total } = await IdeaModel.findByUser(userId, params)

  // Enrich ideas with todo titles
  const enrichedIdeas = ideas.map((idea: any) => ({
    ...idea,
    todo_title: idea.todo_title || null,
  }))

  return {
    success: true,
    data: enrichedIdeas,
    pagination: {
      page: params.page!,
      limit: params.limit!,
      total,
      totalPages: Math.ceil(total / params.limit!),
    },
  }
})
