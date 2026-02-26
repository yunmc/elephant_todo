export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的记录ID' })
  }

  const deleted = await FinanceRecordModel.delete(id, userId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '记录不存在' })
  }

  return { success: true, message: '记录已删除' }
})
