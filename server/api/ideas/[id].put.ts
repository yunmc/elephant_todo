export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  const { content } = await readBody(event)

  const existing = await IdeaModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '随手记不存在' })
  }

  await IdeaModel.update(id, userId, { content })

  const updated = await IdeaModel.findById(id, userId)
  return { success: true, data: updated, message: '随手记更新成功' }
})
