const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const VALID_FLOW_LEVELS = ['light', 'moderate', 'heavy'] as const
const VALID_SYMPTOMS = ['cramps', 'headache', 'bloating', 'fatigue', 'backache', 'nausea', 'insomnia', 'acne'] as const

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { person_name, start_date, end_date, flow_level, symptoms, note } = await readBody(event)

  // Validate start_date
  if (!start_date || typeof start_date !== 'string' || !DATE_RE.test(start_date)) {
    throw createError({ statusCode: 400, message: '开始日期为必填项，格式 YYYY-MM-DD' })
  }

  // Validate end_date
  if (end_date !== undefined && end_date !== null) {
    if (typeof end_date !== 'string' || !DATE_RE.test(end_date)) {
      throw createError({ statusCode: 400, message: '结束日期格式 YYYY-MM-DD' })
    }
    if (end_date < start_date) {
      throw createError({ statusCode: 400, message: '结束日期不能早于开始日期' })
    }
  }

  // Validate flow_level
  if (flow_level !== undefined && !VALID_FLOW_LEVELS.includes(flow_level)) {
    throw createError({ statusCode: 400, message: '流量级别无效' })
  }

  // Validate symptoms
  if (symptoms !== undefined) {
    if (!Array.isArray(symptoms) || symptoms.some((s: string) => !VALID_SYMPTOMS.includes(s as any))) {
      throw createError({ statusCode: 400, message: '症状选项无效' })
    }
  }

  // Validate person_name
  if (person_name !== undefined && (typeof person_name !== 'string' || person_name.length === 0 || person_name.length > 50)) {
    throw createError({ statusCode: 400, message: '记录对象名称1-50字' })
  }

  // Validate note
  if (note !== undefined && typeof note === 'string' && note.length > 500) {
    throw createError({ statusCode: 400, message: '备注不超过500字' })
  }

  const id = await PeriodModel.create(userId, {
    person_name, start_date, end_date, flow_level, symptoms, note,
  })
  const record = await PeriodModel.findById(id, userId)

  setResponseStatus(event, 201)
  return { success: true, data: record, message: '经期记录创建成功' }
})
