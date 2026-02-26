export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id || !Number.isInteger(id)) {
    throw createError({ statusCode: 400, message: '无效的随手记 ID' })
  }

  const idea = await IdeaModel.findById(id, userId)
  if (!idea) {
    throw createError({ statusCode: 404, message: '随手记不存在' })
  }
  if (idea.todo_id) {
    throw createError({ statusCode: 400, message: '该随手记已关联到 Todo，不能转化' })
  }

  // Truncate content to 200 chars for todo title
  const title = idea.content.length > 200 ? idea.content.slice(0, 200) + '...' : idea.content

  // Use transaction to prevent orphaned todo on partial failure
  const db = getDb()
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [result] = await conn.query<any>(
      'INSERT INTO todos (user_id, title) VALUES (?, ?)',
      [userId, title]
    )
    const todoId = result.insertId
    await conn.query(
      'UPDATE ideas SET todo_id = ? WHERE id = ? AND user_id = ?',
      [todoId, id, userId]
    )
    await conn.commit()

    const todo = await TodoModel.findById(todoId, userId)
    setResponseStatus(event, 201)
    return { success: true, data: todo, message: '随手记已转化为 Todo' }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
})
