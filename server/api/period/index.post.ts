export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { start_date, end_date, flow_level, symptoms, mood, note } = await readBody(event)

  if (!start_date) {
    throw createError({ statusCode: 400, message: '开始日期为必填项' })
  }

  const id = await PeriodModel.create(userId, {
    start_date, end_date, flow_level, symptoms, mood, note,
  })
  const record = await PeriodModel.findById(id, userId)

  setResponseStatus(event, 201)
  return { success: true, data: record, message: '经期记录创建成功' }
})
