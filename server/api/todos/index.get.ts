import type { TodoQueryParams } from '~~/server/types'

const VALID_STATUS = ['pending', 'completed']
const VALID_PRIORITY = ['high', 'medium', 'low']
const VALID_SORT_BY = ['created_at', 'due_date', 'priority']
const VALID_SORT_ORDER = ['asc', 'desc']
const VALID_DUE_FILTER = ['today', 'week', 'overdue']

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  const status = VALID_STATUS.includes(query.status as string) ? query.status as any : undefined
  const priority = VALID_PRIORITY.includes(query.priority as string) ? query.priority as any : undefined
  const sort_by = VALID_SORT_BY.includes(query.sort_by as string) ? query.sort_by as any : 'created_at'
  const sort_order = VALID_SORT_ORDER.includes(query.sort_order as string) ? query.sort_order as any : 'desc'
  const due_filter = VALID_DUE_FILTER.includes(query.due_filter as string) ? query.due_filter as any : undefined
  const limit = Math.min(Math.max(1, query.limit ? Number(query.limit) : 20), 100)

  const params: TodoQueryParams = {
    status,
    priority,
    category_id: query.category_id ? Number(query.category_id) : undefined,
    tag_id: query.tag_id ? Number(query.tag_id) : undefined,
    search: query.search ? String(query.search).slice(0, 100) : undefined,
    due_date_start: query.due_date_start as string,
    due_date_end: query.due_date_end as string,
    due_filter,
    page: Math.max(1, query.page ? Number(query.page) : 1),
    limit,
    sort_by,
    sort_order,
  }

  const { todos, total } = await TodoModel.findByUser(userId, params)

  // Batch fetch tags and ideas count (eliminates N+1)
  const todoIds = todos.map(t => t.id)
  const [tagsMap, ideasCountMap] = await Promise.all([
    TodoModel.getTagsBatch(todoIds),
    TodoModel.getIdeasCountBatch(todoIds),
  ])

  const todosWithExtra = todos.map(todo => ({
    ...todo,
    tags: tagsMap.get(todo.id) || [],
    ideas_count: ideasCountMap.get(todo.id) || 0,
  }))

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
