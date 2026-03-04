
export default defineEventHandler(async (event) => {
  const { adminId } = requireAdminAuth(event)

  const body = await readBody(event)
  const { title, type, starts_at, ends_at } = body || {}

  if (!title || !type || !starts_at || !ends_at) {
    throw createError({ statusCode: 400, message: '请填写活动标题、类型、开始和结束时间' })
  }

  if (!['sign_in_bonus', 'holiday_event', 'flash_sale', 'custom'].includes(type)) {
    throw createError({ statusCode: 400, message: '无效的活动类型' })
  }

  const id = await AdminActivityModel.create({
    title,
    type,
    description: body.description,
    config: body.config,
    starts_at,
    ends_at,
    created_by: adminId,
  })

  return { success: true, data: { id }, message: '活动创建成功' }
})
