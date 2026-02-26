import type { TodoQueryParams } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  const params: TodoQueryParams = {
    status: query.status as any,
    priority: query.priority as any,
    category_id: query.category_id ? Number(query.category_id) : undefined,
    tag_id: query.tag_id ? Number(query.tag_id) : undefined,
    search: query.search as string,
    due_date_start: query.due_date_start as string,
    due_date_end: query.due_date_end as string,
    due_filter: query.due_filter as any,
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 20,
    sort_by: (query.sort_by as any) || 'created_at',
    sort_order: (query.sort_order as any) || 'desc',
  }

  const { todos, total } = await TodoModel.findByUser(userId, params)

  const todosWithExtra = await Promise.all(
    todos.map(async (todo) => {
      const [tags, ideasCount] = await Promise.all([
        TodoModel.getTags(todo.id),
        TodoModel.getIdeasCount(todo.id),
      ])
      return { ...todo, tags, ideas_count: ideasCount }
    })
  )

  return {
    success: true,
    data: todosWithExtra,
    pagination: {
      page: params.page!,
      limit: params.limit!,
      total,
      totalPages: Math.ceil(total / params.limit!),
    },
  }
})
