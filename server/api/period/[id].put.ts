export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  const existing = await PeriodModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '经期记录不存在' })
  }

  await PeriodModel.update(id, userId, body)
  const updated = await PeriodModel.findById(id, userId)

  return { success: true, data: updated, message: '经期记录更新成功' }
})
