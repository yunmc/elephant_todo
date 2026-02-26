export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const deleted = await FinanceRecordModel.delete(id, userId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '记录不存在' })
  }

  return { success: true, message: '记录已删除' }
})
