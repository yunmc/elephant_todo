export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  const todo = await TodoModel.findById(id, userId)
  if (!todo) {
    throw createError({ statusCode: 404, message: 'Todo 不存在' })
  }

  const [tags, ideasCount] = await Promise.all([
    TodoModel.getTags(todo.id),
    TodoModel.getIdeasCount(todo.id),
  ])

  return { success: true, data: { ...todo, tags, ideas_count: ideasCount } }
})
