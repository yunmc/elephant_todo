export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id || !Number.isInteger(id)) {
    throw createError({ statusCode: 400, message: '无效的习惯 ID' })
  }

  const body = await readBody(event)
  const existing = await ChecklistModel.getItem(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '习惯不存在' })
  }

  const updateData: Record<string, any> = {}
  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) throw createError({ statusCode: 400, message: '标题不能为空' })
    if (title.length > 100) throw createError({ statusCode: 400, message: '标题不能超过100个字符' })
    updateData.title = title
  }
  if (body.icon !== undefined) {
    updateData.icon = typeof body.icon === 'string' ? body.icon.trim() || '✅' : '✅'
  }
  if (body.is_active !== undefined) {
    updateData.is_active = body.is_active ? 1 : 0
  }

  await ChecklistModel.updateItem(id, userId, updateData)
  const updated = await ChecklistModel.getItem(id, userId)

  return { success: true, data: updated, message: '习惯更新成功' }
})
