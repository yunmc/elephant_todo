import { eq, and } from 'drizzle-orm'
import * as schema from '~/server/database/schema'

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

  // Use Drizzle transaction to prevent orphaned todo on partial failure
  const db = getDb()
  const todo = await db.transaction(async (tx) => {
    const result = await tx.insert(schema.todos).values({
      user_id: userId,
      title,
    })
    const todoId = Number(result[0].insertId)
    await tx.update(schema.ideas)
      .set({ todo_id: todoId })
      .where(and(eq(schema.ideas.id, id), eq(schema.ideas.user_id, userId)))

    return await TodoModel.findById(todoId, userId)
  })

  setResponseStatus(event, 201)
  return { success: true, data: todo, message: '随手记已转化为 Todo' }
})
