export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const { content, source, todo_id } = await readBody(event)

  if (!content) {
    throw createError({ statusCode: 400, message: '内容为必填项' })
  }

  if (todo_id) {
    const todo = await TodoModel.findById(todo_id, userId)
    if (!todo) {
      throw createError({ statusCode: 404, message: '关联的 Todo 不存在' })
    }
  }

  const ideaId = await IdeaModel.create(userId, { content, source, todo_id })

  const idea = await IdeaModel.findById(ideaId, userId)

  setResponseStatus(event, 201)
  return { success: true, data: idea, message: '随手记创建成功' }
})
