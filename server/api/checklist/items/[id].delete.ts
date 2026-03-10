export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id || !Number.isInteger(id)) {
    throw createError({ statusCode: 400, message: '无效的习惯 ID' })
  }

  const deleted = await ChecklistModel.deleteItem(id, userId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: '习惯不存在' })
  }

  return { success: true, message: '习惯已删除' }
})
