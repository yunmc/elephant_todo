export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  const deleted = await ImportantDateModel.delete(id, userId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '重要日期不存在' })
  }

  return { success: true, message: '重要日期已删除' }
})
