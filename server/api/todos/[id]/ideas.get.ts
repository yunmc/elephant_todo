export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const todo = await TodoModel.findById(id, userId)
  if (!todo) {
    throw createError({ statusCode: 404, message: 'Todo 不存在' })
  }

  const ideas = await IdeaModel.findByTodoId(todo.id)

  return { success: true, data: ideas }
})
