export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const deleted = await TodoModel.delete(id, userId)
  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Todo 不存在' })
  }

  return { success: true, message: 'Todo 已删除' }
})
