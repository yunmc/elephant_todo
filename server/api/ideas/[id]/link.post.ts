export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  const { todo_id } = await readBody(event)

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
