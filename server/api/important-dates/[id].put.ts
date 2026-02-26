export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  const existing = await ImportantDateModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '重要日期不存在' })
  }

  await ImportantDateModel.update(id, userId, body)
  const updated = await ImportantDateModel.findById(id, userId)

  return { success: true, data: updated, message: '重要日期更新成功' }
})
