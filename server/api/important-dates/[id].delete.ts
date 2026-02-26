export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const deleted = await ImportantDateModel.delete(id, userId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '重要日期不存在' })
  }

  return { success: true, message: '重要日期已删除' }
})
