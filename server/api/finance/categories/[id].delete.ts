export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const deleted = await FinanceCategoryModel.delete(id, userId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '分类不存在' })
  }

  return { success: true, message: '分类已删除' }
})
