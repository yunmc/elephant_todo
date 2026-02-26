export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  const { title, description, priority, category_id, due_date, tag_ids } = await readBody(event)

  const existing = await TodoModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Todo 不存在' })
  }

  await TodoModel.update(id, userId, { title, description, priority, category_id, due_date })

  if (tag_ids !== undefined) {
    await TodoModel.updateTags(id, tag_ids)
  }

  const updated = await TodoModel.findById(id, userId)
  const tags = await TodoModel.getTags(id)

  return { success: true, data: { ...updated, tags }, message: 'Todo 更新成功' }
})
