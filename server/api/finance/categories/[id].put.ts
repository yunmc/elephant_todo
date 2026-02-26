export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  const existing = await FinanceCategoryModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '分类不存在' })
  }

  await FinanceCategoryModel.update(id, userId, body)
  const updated = await FinanceCategoryModel.findById(id, userId)

  return { success: true, data: updated, message: '分类更新成功' }
})
