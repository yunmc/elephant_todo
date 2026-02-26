import type { UpdateSubtaskDTO } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const todoId = Number(getRouterParam(event, 'id'))
  const subtaskId = Number(getRouterParam(event, 'subtaskId'))
  const { title, status, sort_order } = await readBody(event)

  // Verify the todo belongs to this user
  const todo = await TodoModel.findById(todoId, userId)
  if (!todo) {
    throw createError({ statusCode: 404, message: 'Todo 不存在' })
  }

  const data: UpdateSubtaskDTO = {}
  if (title !== undefined) data.title = title
  if (status !== undefined) data.status = status
  if (sort_order !== undefined) data.sort_order = sort_order

  const updated = await SubtaskModel.update(subtaskId, todoId, data)
  if (!updated) {
    throw createError({ statusCode: 404, message: '子任务不存在' })
  }

  const subtask = await SubtaskModel.findById(subtaskId, todoId)
  return { success: true, data: subtask }
})
