export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id || !Number.isInteger(id)) {
    throw createError({ statusCode: 400, message: '无效的随手记 ID' })
  }

  const { todo_id } = await readBody(event)
  if (!todo_id || !Number.isInteger(todo_id) || todo_id <= 0) {
    throw createError({ statusCode: 400, message: '无效的 Todo ID' })
  }

  const idea = await IdeaModel.findById(id, userId)
  if (!idea) {
    throw createError({ statusCode: 404, message: '随手记不存在' })
  }

  const todo = await TodoModel.findById(todo_id, userId)
  if (!todo) {
    throw createError({ statusCode: 404, message: 'Todo 不存在' })
  }

  await IdeaModel.linkToTodo(id, userId, todo_id)

  const updated = await IdeaModel.findById(id, userId)
  return { success: true, data: updated, message: '已关联到 Todo' }
})
