export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const todoId = Number(getRouterParam(event, 'id'))
  const { title } = await readBody(event)

  if (!title?.trim()) {
    throw createError({ statusCode: 400, message: '子任务标题不能为空' })
  }

  // Verify the todo belongs to this user
  const todo = await TodoModel.findById(todoId, userId)
  if (!todo) {
    throw createError({ statusCode: 404, message: 'Todo 不存在' })
  }

  const insertId = await SubtaskModel.create(todoId, { title: title.trim() })
  const subtask = await SubtaskModel.findById(insertId, todoId)

  return { success: true, data: subtask }
})
