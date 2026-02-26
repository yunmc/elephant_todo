export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const idea = await IdeaModel.findById(id, userId)
  if (!idea) {
    throw createError({ statusCode: 404, message: '随手记不存在' })
  }

  await IdeaModel.unlink(id, userId)

  const updated = await IdeaModel.findById(id, userId)
  return { success: true, data: updated, message: '已取消关联' }
})
