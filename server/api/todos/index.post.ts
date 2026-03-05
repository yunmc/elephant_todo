const VALID_PRIORITIES = ['high', 'medium', 'low']

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody(event)

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    throw createError({ statusCode: 400, message: '标题为必填项' })
  }
  if (title.length > 200) {
    throw createError({ statusCode: 400, message: '标题不能超过200个字符' })
  }

  const priority = VALID_PRIORITIES.includes(body.priority) ? body.priority : 'medium'
  const description = typeof body.description === 'string' ? body.description.trim() || null : null
  const category_id = body.category_id ? Number(body.category_id) : null
  const due_date = body.due_date ? new Date(body.due_date) : null
  const tag_ids = Array.isArray(body.tag_ids) ? body.tag_ids.filter((id: any) => typeof id === 'number' && Number.isInteger(id) && id > 0) : []

  const todoId = await TodoModel.create(userId, { title, description, priority, category_id, due_date })

  if (tag_ids.length > 0) {
    await TodoModel.updateTags(todoId, tag_ids)
  }

  const todo = await TodoModel.findById(todoId, userId)

  setResponseStatus(event, 201)
  return { success: true, data: todo, message: 'Todo 创建成功' }
})
