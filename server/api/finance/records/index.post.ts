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

  const id = await FinanceRecordModel.create(userId, { category_id, type, amount: Number(amount), note, record_date })
  const record = await FinanceRecordModel.findById(id, userId)

  setResponseStatus(event, 201)
  return { success: true, data: record, message: '记录创建成功' }
})
