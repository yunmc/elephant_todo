export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的分组ID' })
  }

  const existing = await VaultModel.findGroupById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '分组不存在' })
  }

  await VaultModel.deleteGroup(id, userId)
  return { success: true, message: '分组已删除' }
})
