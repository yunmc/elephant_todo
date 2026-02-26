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

  return { success: true, data: idea }
})
