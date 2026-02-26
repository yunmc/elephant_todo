const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { category_id, type, amount, note, record_date } = await readBody(event)

  if (!type || !amount || !record_date) {
    throw createError({ statusCode: 400, message: '类型、金额和日期为必填项' })
  }
  if (!['income', 'expense'].includes(type)) {
    throw createError({ statusCode: 400, message: '类型必须为 income 或 expense' })
  }
  if (Number(amount) <= 0) {
    throw createError({ statusCode: 400, message: '金额必须大于 0' })
  }
  if (!DATE_REGEX.test(record_date) || isNaN(Date.parse(record_date))) {
    throw createError({ statusCode: 400, message: '日期格式必须为 YYYY-MM-DD' })
  }
  if (note && typeof note === 'string' && note.length > 500) {
    throw createError({ statusCode: 400, message: '备注不能超过500个字符' })
  }
  // Verify category belongs to user
  if (category_id) {
    const cat = await FinanceCategoryModel.findById(Number(category_id), userId)
    if (!cat) throw createError({ statusCode: 400, message: '分类不存在' })
  }

  const id = await FinanceRecordModel.create(userId, {
    category_id: category_id ? Number(category_id) : undefined,
    type,
    amount: Number(amount),
    note: note || undefined,
    record_date,
  })
  const record = await FinanceRecordModel.findById(id, userId)

  setResponseStatus(event, 201)
  return { success: true, data: record, message: '记录创建成功' }
})
