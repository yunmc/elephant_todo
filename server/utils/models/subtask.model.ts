import { eq, and, asc, sql } from 'drizzle-orm'
import type { SubtaskRow, CreateSubtaskDTO, UpdateSubtaskDTO } from '~~/server/types'
import { subtasks } from '../../database/schema'

export const SubtaskModel = {
  async findByTodo(todoId: number): Promise<SubtaskRow[]> {
    const rows = await getDb().select().from(subtasks)
      .where(eq(subtasks.todo_id, todoId))
      .orderBy(asc(subtasks.sort_order), asc(subtasks.created_at))
    return rows as unknown as SubtaskRow[]
  },

  async findById(id: number, todoId: number): Promise<SubtaskRow | null> {
    const rows = await getDb().select().from(subtasks)
      .where(and(eq(subtasks.id, id), eq(subtasks.todo_id, todoId)))
    return (rows[0] as unknown as SubtaskRow) || null
  },

  async create(todoId: number, data: CreateSubtaskDTO): Promise<number> {
    let sortOrder = data.sort_order
    if (sortOrder === undefined) {
      const [row] = await getDb().select({
        next_order: sql<number>`COALESCE(MAX(${subtasks.sort_order}), -1) + 1`,
      }).from(subtasks).where(eq(subtasks.todo_id, todoId))
      sortOrder = row.next_order
    }
    const result = await getDb().insert(subtasks).values({
      todo_id: todoId,
      title: data.title,
      sort_order: sortOrder,
    })
    return result[0].insertId
  },

  async update(id: number, todoId: number, data: UpdateSubtaskDTO): Promise<boolean> {
    const setObj: Record<string, any> = {}
    if (data.title !== undefined) setObj.title = data.title
    if (data.status !== undefined) setObj.status = data.status
    if (data.sort_order !== undefined) setObj.sort_order = data.sort_order
    if (Object.keys(setObj).length === 0) return false

    const result = await getDb().update(subtasks).set(setObj)
      .where(and(eq(subtasks.id, id), eq(subtasks.todo_id, todoId)))
    return result[0].affectedRows > 0
  },

  async toggleStatus(id: number, todoId: number): Promise<SubtaskRow | null> {
    await getDb().update(subtasks)
      .set({ status: sql`IF(${subtasks.status} = 'pending', 'completed', 'pending')` })
      .where(and(eq(subtasks.id, id), eq(subtasks.todo_id, todoId)))
    return this.findById(id, todoId)
  },

  async delete(id: number, todoId: number): Promise<boolean> {
    const result = await getDb().delete(subtasks)
      .where(and(eq(subtasks.id, id), eq(subtasks.todo_id, todoId)))
    return result[0].affectedRows > 0
  },
}
