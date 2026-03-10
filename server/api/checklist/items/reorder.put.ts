export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody(event)

  const itemIds = body.item_ids
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    throw createError({ statusCode: 400, message: 'item_ids 为必填数组' })
  }

  const validIds = itemIds.filter((id: any) => typeof id === 'number' && Number.isInteger(id) && id > 0)
  if (validIds.length === 0) {
    throw createError({ statusCode: 400, message: 'item_ids 包含无效 ID' })
  }

  await ChecklistModel.reorderItems(userId, validIds)
  return { success: true, message: '排序更新成功' }
})
