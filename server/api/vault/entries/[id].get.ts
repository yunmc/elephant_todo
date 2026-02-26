export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id || !Number.isInteger(id)) {
    throw createError({ statusCode: 400, message: '无效的条目ID' })
  }

  const entry = await VaultModel.findEntryById(id, userId)
  if (!entry) {
    throw createError({ statusCode: 404, message: '条目不存在' })
  }

  return { success: true, data: entry }
})
