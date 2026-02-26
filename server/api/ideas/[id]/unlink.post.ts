export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id || !Number.isInteger(id)) {
    throw createError({ statusCode: 400, message: '无效的随手记 ID' })
  }

  const idea = await IdeaModel.findById(id, userId)
  if (!idea) {
    throw createError({ statusCode: 404, message: '随手记不存在' })
  }
  if (!idea.todo_id) {
    throw createError({ statusCode: 400, message: '该随手记未关联任何待办' })
  }

  await IdeaModel.unlink(id, userId)

  const updated = await IdeaModel.findById(id, userId)
  return { success: true, data: updated, message: '已取消关联' }
})
