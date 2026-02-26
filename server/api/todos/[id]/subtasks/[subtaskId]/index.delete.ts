export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const todoId = Number(getRouterParam(event, 'id'))
  const subtaskId = Number(getRouterParam(event, 'subtaskId'))

  // Verify the todo belongs to this user
  const todo = await TodoModel.findById(todoId, userId)
  if (!todo) {
    throw createError({ statusCode: 404, message: 'Todo 不存在' })
  }

  const deleted = await SubtaskModel.delete(subtaskId, todoId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '子任务不存在' })
  }

  return { success: true }
})
