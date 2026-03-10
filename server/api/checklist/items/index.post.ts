export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody(event)

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    throw createError({ statusCode: 400, message: '标题为必填项' })
  }
  if (title.length > 100) {
    throw createError({ statusCode: 400, message: '标题不能超过100个字符' })
  }

  const icon = typeof body.icon === 'string' ? body.icon.trim() || '✅' : '✅'

  const itemId = await ChecklistModel.createItem(userId, { title, icon })
  const item = await ChecklistModel.getItem(itemId, userId)

  setResponseStatus(event, 201)
  return { success: true, data: item, message: '习惯创建成功' }
})
