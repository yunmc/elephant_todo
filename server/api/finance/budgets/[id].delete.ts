export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  await requirePremium(userId)

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的预算 ID' })
  }

  const deleted = await FinanceBudgetModel.delete(id, userId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '预算不存在或无权删除' })
  }

  return { success: true }
})
