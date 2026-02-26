export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const deleted = await PeriodModel.delete(id, userId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '经期记录不存在' })
  }

  return { success: true, message: '经期记录已删除' }
})
