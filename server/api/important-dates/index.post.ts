export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { title, date, is_lunar, repeat_yearly, remind_days_before, icon, note } = await readBody(event)

  if (!title || !date) {
    throw createError({ statusCode: 400, message: '标题和日期为必填项' })
  }

  const id = await ImportantDateModel.create(userId, {
    title, date, is_lunar, repeat_yearly, remind_days_before, icon, note,
  })
  const created = await ImportantDateModel.findById(id, userId)

  setResponseStatus(event, 201)
  return { success: true, data: created, message: '重要日期创建成功' }
})
