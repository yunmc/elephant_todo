const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  const body = await readBody(event)
  const existing = await ImportantDateModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '重要日期不存在' })
  }

  // Whitelist fields + validate
  const updateData: Record<string, any> = {}
  if (body.title !== undefined) {
    const trimmed = typeof body.title === 'string' ? body.title.trim() : ''
    if (!trimmed) throw createError({ statusCode: 400, message: '标题不能为空' })
    if (trimmed.length > 200) throw createError({ statusCode: 400, message: '标题不能超过200个字符' })
    updateData.title = trimmed
  }
  if (body.date !== undefined) {
    if (!DATE_REGEX.test(body.date) || isNaN(Date.parse(body.date))) {
      throw createError({ statusCode: 400, message: '日期格式必须为 YYYY-MM-DD' })
    }
    updateData.date = body.date
  }
  if (body.is_lunar !== undefined) updateData.is_lunar = !!body.is_lunar
  if (body.repeat_yearly !== undefined) updateData.repeat_yearly = !!body.repeat_yearly
  if (body.remind_days_before !== undefined) {
    const r = Number(body.remind_days_before)
    if (!Number.isInteger(r) || r < 0 || r > 365) {
      throw createError({ statusCode: 400, message: '提醒天数必须为 0-365 之间的整数' })
    }
    updateData.remind_days_before = r
  }
  if (body.icon !== undefined) {
    if (typeof body.icon === 'string' && body.icon.length > 20) {
      throw createError({ statusCode: 400, message: '图标内容过长' })
    }
    updateData.icon = body.icon
  }
  if (body.note !== undefined) {
    if (typeof body.note === 'string' && body.note.length > 2000) {
      throw createError({ statusCode: 400, message: '备注不能超过2000个字符' })
    }
    updateData.note = body.note
  }

  if (Object.keys(updateData).length === 0) {
    throw createError({ statusCode: 400, message: '没有可更新的字段' })
  }

  await ImportantDateModel.update(id, userId, updateData)
  const updated = await ImportantDateModel.findById(id, userId)

  return { success: true, data: updated, message: '重要日期更新成功' }
})
