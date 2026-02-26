export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id || !Number.isInteger(id)) {
    throw createError({ statusCode: 400, message: '无效的随手记 ID' })
  }

  const body = await readBody(event)
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) {
    throw createError({ statusCode: 400, message: '内容不能为空' })
  }
  if (content.length > 5000) {
    throw createError({ statusCode: 400, message: '内容不能超过5000个字符' })
  }

  const existing = await IdeaModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '随手记不存在' })
  }

  await IdeaModel.update(id, userId, { content })

  const updated = await IdeaModel.findById(id, userId)
  return { success: true, data: updated, message: '随手记更新成功' }
})
