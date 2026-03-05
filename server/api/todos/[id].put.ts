const VALID_PRIORITIES = ['high', 'medium', 'low']

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id || !Number.isInteger(id)) {
    throw createError({ statusCode: 400, message: '无效的 Todo ID' })
  }

  const body = await readBody(event)

  const existing = await TodoModel.findById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Todo 不存在' })
  }

  // Build validated update data
  const updateData: Record<string, any> = {}
  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) throw createError({ statusCode: 400, message: '标题不能为空' })
    if (title.length > 200) throw createError({ statusCode: 400, message: '标题不能超过200个字符' })
    updateData.title = title
  }
  if (body.description !== undefined) {
    updateData.description = typeof body.description === 'string' ? body.description.trim() || null : null
  }
  if (body.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(body.priority)) throw createError({ statusCode: 400, message: '无效的优先级' })
    updateData.priority = body.priority
  }
  if (body.category_id !== undefined) {
    updateData.category_id = body.category_id ? Number(body.category_id) : null
  }
  if (body.due_date !== undefined) {
    updateData.due_date = body.due_date ? new Date(body.due_date) : null
  }

  await TodoModel.update(id, userId, updateData)

  if (body.tag_ids !== undefined) {
    const tag_ids = Array.isArray(body.tag_ids) ? body.tag_ids.filter((tid: any) => typeof tid === 'number' && Number.isInteger(tid) && tid > 0) : []
    await TodoModel.updateTags(id, tag_ids)
  }

  const updated = await TodoModel.findById(id, userId)
  const tags = await TodoModel.getTags(id)

  return { success: true, data: { ...updated, tags }, message: 'Todo 更新成功' }
})
