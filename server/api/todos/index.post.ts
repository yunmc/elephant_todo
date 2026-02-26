export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { title, description, priority, category_id, due_date, tag_ids } = await readBody(event)

  if (!title) {
    throw createError({ statusCode: 400, message: '标题为必填项' })
  }

  const todoId = await TodoModel.create(userId, { title, description, priority, category_id, due_date })

  if (tag_ids && tag_ids.length > 0) {
    await TodoModel.updateTags(todoId, tag_ids)
  }

  const todo = await TodoModel.findById(todoId, userId)

  setResponseStatus(event, 201)
  return { success: true, data: todo, message: 'Todo 创建成功' }
})
