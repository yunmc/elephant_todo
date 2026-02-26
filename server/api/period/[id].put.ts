const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const VALID_FLOW_LEVELS = ['light', 'moderate', 'heavy'] as const
const VALID_SYMPTOMS = ['cramps', 'headache', 'bloating', 'fatigue', 'backache', 'nausea', 'insomnia', 'acne'] as const
const ALLOWED_FIELDS = ['person_name', 'start_date', 'end_date', 'flow_level', 'symptoms', 'note'] as const

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID 无效' })
  }

  const body = await readBody(event)

  // Whitelist fields
  const data: Record<string, any> = {}
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key]
  }
  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, message: '未提供有效字段' })
  }

  // Validate dates
  if (data.start_date !== undefined && (typeof data.start_date !== 'string' || !DATE_RE.test(data.start_date))) {
    throw createError({ statusCode: 400, message: '开始日期格式 YYYY-MM-DD' })
  }
  if (data.end_date !== undefined && data.end_date !== null) {
    if (typeof data.end_date !== 'string' || !DATE_RE.test(data.end_date)) {
      throw createError({ statusCode: 400, message: '结束日期格式 YYYY-MM-DD' })
    }
  }
  if (data.start_date && data.end_date && data.end_date < data.start_date) {
    throw createError({ statusCode: 400, message: '结束日期不能早于开始日期' })
  }

  // Validate flow_level
  if (data.flow_level !== undefined && !VALID_FLOW_LEVELS.includes(data.flow_level)) {
    throw createError({ statusCode: 400, message: '流量级别无效' })
  }

  // Validate symptoms
  if (data.symptoms !== undefined) {
    if (!Array.isArray(data.symptoms) || data.symptoms.some((s: string) => !VALID_SYMPTOMS.includes(s as any))) {
      throw createError({ statusCode: 400, message: '症状选项无效' })
    }
  }

  // Validate person_name
  if (data.person_name !== undefined && (typeof data.person_name !== 'string' || data.person_name.length === 0 || data.person_name.length > 50)) {
    throw createError({ statusCode: 400, message: '记录对象名称1-50字' })
  }

  // Validate note
  if (data.note !== undefined && typeof data.note === 'string' && data.note.length > 500) {
    throw createError({ statusCode: 400, message: '备注不超过500字' })
  }

  const existing = await PeriodModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '经期记录不存在' })
  }

  await PeriodModel.update(id, userId, data)
  const updated = await PeriodModel.findById(id, userId)

  return { success: true, data: updated, message: '经期记录更新成功' }
})
