export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  const existing = await FinanceRecordModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '记录不存在' })
  }

  if (body.amount !== undefined) body.amount = Number(body.amount)

  await FinanceRecordModel.update(id, userId, body)
  const updated = await FinanceRecordModel.findById(id, userId)

  return { success: true, data: updated, message: '记录更新成功' }
})
