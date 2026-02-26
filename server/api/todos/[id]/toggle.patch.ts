export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const todo = await TodoModel.toggleStatus(id, userId)
  if (!todo) {
    throw createError({ statusCode: 404, message: 'Todo 不存在' })
  }

  return {
    success: true,
    data: todo,
    message: `Todo 已${todo.status === 'completed' ? '完成' : '恢复'}`,
  }
})
