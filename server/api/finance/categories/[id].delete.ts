export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的分类ID' })
  }

  const deleted = await FinanceCategoryModel.delete(id, userId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '分类不存在' })
  }

  return { success: true, message: '分类已删除' }
})
