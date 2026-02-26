const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { title, date, is_lunar, repeat_yearly, remind_days_before, icon, note } = await readBody(event)

  const trimmedTitle = typeof title === 'string' ? title.trim() : ''
  if (!trimmedTitle || !date) {
    throw createError({ statusCode: 400, message: '标题和日期为必填项' })
  }
  if (trimmedTitle.length > 200) {
    throw createError({ statusCode: 400, message: '标题不能超过200个字符' })
  }
  if (!DATE_REGEX.test(date) || isNaN(Date.parse(date))) {
    throw createError({ statusCode: 400, message: '日期格式必须为 YYYY-MM-DD' })
  }
  if (remind_days_before !== undefined) {
    const r = Number(remind_days_before)
    if (!Number.isInteger(r) || r < 0 || r > 365) {
      throw createError({ statusCode: 400, message: '提醒天数必须为 0-365 之间的整数' })
    }
  }
  if (icon && typeof icon === 'string' && icon.length > 20) {
    throw createError({ statusCode: 400, message: '图标内容过长' })
  }
  if (note && typeof note === 'string' && note.length > 2000) {
    throw createError({ statusCode: 400, message: '备注不能超过2000个字符' })
  }

  const id = await ImportantDateModel.create(userId, {
    title: trimmedTitle, date, is_lunar: !!is_lunar, repeat_yearly: !!repeat_yearly,
    remind_days_before: remind_days_before ?? 0, icon, note,
  })
  const created = await ImportantDateModel.findById(id, userId)

  setResponseStatus(event, 201)
  return { success: true, data: created, message: '重要日期创建成功' }
})
