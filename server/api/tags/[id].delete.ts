export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的标签ID' })
  }

  const existing = await TagModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '标签不存在' })
  }

  await TagModel.delete(id, userId)
  return { success: true, message: '标签已删除' }
})
