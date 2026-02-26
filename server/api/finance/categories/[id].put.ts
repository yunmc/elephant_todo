export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的分类ID' })
  }

  const body = await readBody(event)
  const existing = await FinanceCategoryModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '分类不存在' })
  }

  // Whitelist fields + validate
  const updateData: Record<string, any> = {}
  if (body.name !== undefined) {
    const trimmed = typeof body.name === 'string' ? body.name.trim() : ''
    if (!trimmed) throw createError({ statusCode: 400, message: '分类名称不能为空' })
    if (trimmed.length > 50) throw createError({ statusCode: 400, message: '分类名称不能超过50个字符' })
    updateData.name = trimmed
  }
  if (body.icon !== undefined) updateData.icon = body.icon
  if (body.type !== undefined) {
    if (!['income', 'expense'].includes(body.type)) {
      throw createError({ statusCode: 400, message: '类型必须为 income 或 expense' })
    }
    updateData.type = body.type
  }
  if (body.sort_order !== undefined) {
    updateData.sort_order = typeof body.sort_order === 'number' && Number.isInteger(body.sort_order) && body.sort_order >= 0 ? body.sort_order : 0
  }

  await FinanceCategoryModel.update(id, userId, updateData)
  const updated = await FinanceCategoryModel.findById(id, userId)
  return { success: true, data: updated, message: '分类更新成功' }
})
