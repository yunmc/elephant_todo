const VALID_SOURCES = ['text', 'voice']

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody(event)

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) {
    throw createError({ statusCode: 400, message: '内容为必填项' })
  }
  if (content.length > 5000) {
    throw createError({ statusCode: 400, message: '内容不能超过5000个字符' })
  }

  const source = VALID_SOURCES.includes(body.source) ? body.source : 'text'
  const todo_id = body.todo_id !== undefined ? Number(body.todo_id) : undefined

  if (todo_id !== undefined) {
    if (!Number.isInteger(todo_id) || todo_id <= 0) {
      throw createError({ statusCode: 400, message: '无效的 Todo ID' })
    }
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
