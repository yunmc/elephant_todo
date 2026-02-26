export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的条目ID' })
  }

  const existing = await VaultModel.findEntryById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '条目不存在' })
  }

  await VaultModel.deleteEntry(id, userId)
  return { success: true, message: '条目已删除' }
})
