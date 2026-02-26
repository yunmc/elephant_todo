export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const todoId = Number(getRouterParam(event, 'id'))

  // Verify the todo belongs to this user
  const todo = await TodoModel.findById(todoId, userId)
  if (!todo) {
    throw createError({ statusCode: 404, message: 'Todo 不存在' })
  }

  const subtasks = await SubtaskModel.findByTodo(todoId)
  return { success: true, data: subtasks }
})
