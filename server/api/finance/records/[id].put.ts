const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的记录ID' })
  }

  const body = await readBody(event)
  const existing = await FinanceRecordModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '记录不存在' })
  }

  // Whitelist fields + validate
  const updateData: Record<string, any> = {}
  if (body.type !== undefined) {
    if (!['income', 'expense'].includes(body.type)) {
      throw createError({ statusCode: 400, message: '类型必须为 income 或 expense' })
    }
    updateData.type = body.type
  }
  if (body.amount !== undefined) {
    const amt = Number(body.amount)
    if (isNaN(amt) || amt <= 0) {
      throw createError({ statusCode: 400, message: '金额必须大于 0' })
    }
    updateData.amount = amt
  }
  if (body.record_date !== undefined) {
    if (!DATE_REGEX.test(body.record_date) || isNaN(Date.parse(body.record_date))) {
      throw createError({ statusCode: 400, message: '日期格式必须为 YYYY-MM-DD' })
    }
    updateData.record_date = body.record_date
  }
  if (body.note !== undefined) {
    if (typeof body.note === 'string' && body.note.length > 500) {
      throw createError({ statusCode: 400, message: '备注不能超过500个字符' })
    }
    updateData.note = body.note
  }
  if (body.category_id !== undefined) {
    updateData.category_id = body.category_id
  }

  await FinanceRecordModel.update(id, userId, updateData)
  const updated = await FinanceRecordModel.findById(id, userId)
  return { success: true, data: updated, message: '记录更新成功' }
})
