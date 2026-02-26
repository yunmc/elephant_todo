export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const deleted = await IdeaModel.delete(id, userId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '随手记不存在' })
  }
  return { success: true, message: '随手记已删除' }
})
