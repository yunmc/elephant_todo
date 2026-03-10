export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody(event)

  const itemId = Number(body.item_id)
  if (!itemId || !Number.isInteger(itemId)) {
    throw createError({ statusCode: 400, message: '无效的 item_id' })
  }

  let date: string
  if (body.date && typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    date = body.date
  } else {
    const now = new Date()
    date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }

  // Verify item belongs to user
  const item = await ChecklistModel.getItem(itemId, userId)
  if (!item) {
    throw createError({ statusCode: 404, message: '习惯不存在' })
  }

  await ChecklistModel.uncheckIn(itemId, userId, date)
  return { success: true, message: '已取消打卡' }
})
