export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const idea = await IdeaModel.findById(id, userId)
  if (!idea) {
    throw createError({ statusCode: 404, message: '随手记不存在' })
  }
  if (idea.todo_id) {
    throw createError({ statusCode: 400, message: '该随手记已关联到 Todo，不能转化' })
  }

  const todoId = await TodoModel.create(userId, { title: idea.content })
  await IdeaModel.linkToTodo(id, userId, todoId)

  const todo = await TodoModel.findById(todoId, userId)

  setResponseStatus(event, 201)
  return { success: true, data: todo, message: '随手记已转化为 Todo' }
})
