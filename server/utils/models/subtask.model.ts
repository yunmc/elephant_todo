import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { SubtaskRow, CreateSubtaskDTO, UpdateSubtaskDTO } from '~~/server/types'

export const SubtaskModel = {
  async findByTodo(todoId: number): Promise<SubtaskRow[]> {
    const [rows] = await getDb().query<SubtaskRow[]>(
      'SELECT * FROM subtasks WHERE todo_id = ? ORDER BY sort_order ASC, created_at ASC',
      [todoId],
    )
    return rows
  },

  async findById(id: number, todoId: number): Promise<SubtaskRow | null> {
    const [rows] = await getDb().query<SubtaskRow[]>(
      'SELECT * FROM subtasks WHERE id = ? AND todo_id = ?',
      [id, todoId],
    )
    return rows[0] || null
  },

  async create(todoId: number, data: CreateSubtaskDTO): Promise<number> {
    // Auto-assign sort_order if not provided
    let sortOrder = data.sort_order
    if (sortOrder === undefined) {
      const [rows] = await getDb().query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM subtasks WHERE todo_id = ?',
        [todoId],
      )
      sortOrder = rows[0].next_order as number
    }
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO subtasks (todo_id, title, sort_order) VALUES (?, ?, ?)',
      [todoId, data.title, sortOrder],
    )
    return result.insertId
  },

  async update(id: number, todoId: number, data: UpdateSubtaskDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title) }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status) }
    if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE subtasks SET ${fields.join(', ')} WHERE id = ? AND todo_id = ?`,
      [...values, id, todoId],
    )
    return result.affectedRows > 0
  },

  async toggleStatus(id: number, todoId: number): Promise<SubtaskRow | null> {
    await getDb().query(
      `UPDATE subtasks SET status = IF(status = 'pending', 'completed', 'pending') WHERE id = ? AND todo_id = ?`,
      [id, todoId],
    )
    return this.findById(id, todoId)
  },

  async delete(id: number, todoId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM subtasks WHERE id = ? AND todo_id = ?',
      [id, todoId],
    )
    return result.affectedRows > 0
  },
}
