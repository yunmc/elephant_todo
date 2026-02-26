import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { IdeaRow, CreateIdeaDTO, UpdateIdeaDTO, IdeaQueryParams } from '~~/server/types'

const MAX_LIMIT = 100

// Strip FULLTEXT boolean mode special characters to prevent MySQL parse errors
function sanitizeFulltextSearch(input: string): string {
  return input.replace(/[+\-~*"()@<>]/g, ' ').replace(/\s+/g, ' ').trim()
}

export const IdeaModel = {
  async findByUser(userId: number, params: IdeaQueryParams): Promise<{ ideas: IdeaRow[]; total: number }> {
    const page = Math.max(1, params.page || 1)
    const limit = Math.min(Math.max(1, params.limit || 20), MAX_LIMIT)
    const offset = (page - 1) * limit

    let whereClause = 'WHERE i.user_id = ?'
    const queryParams: any[] = [userId]

    if (params.linked === 'true') { whereClause += ' AND i.todo_id IS NOT NULL' }
    else if (params.linked === 'false') { whereClause += ' AND i.todo_id IS NULL' }
    if (params.source && ['text', 'voice'].includes(params.source)) { whereClause += ' AND i.source = ?'; queryParams.push(params.source) }
    if (params.search) {
      const sanitized = sanitizeFulltextSearch(params.search)
      if (sanitized) { whereClause += ' AND MATCH(i.content) AGAINST(? IN BOOLEAN MODE)'; queryParams.push(sanitized) }
    }

    const [countResult] = await getDb().query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM ideas i ${whereClause}`, queryParams
    )
    const total = countResult[0].total as number

    const [ideas] = await getDb().query<IdeaRow[]>(
      `SELECT i.*, t.title as todo_title FROM ideas i LEFT JOIN todos t ON i.todo_id = t.id ${whereClause} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )

    return { ideas, total }
  },

  async findById(id: number, userId: number): Promise<IdeaRow | null> {
    const [rows] = await getDb().query<IdeaRow[]>(
      'SELECT i.*, t.title as todo_title FROM ideas i LEFT JOIN todos t ON i.todo_id = t.id WHERE i.id = ? AND i.user_id = ?', [id, userId]
    )
    return rows[0] || null
  },

  async findByTodoId(todoId: number): Promise<IdeaRow[]> {
    const [rows] = await getDb().query<IdeaRow[]>(
      'SELECT * FROM ideas WHERE todo_id = ? ORDER BY created_at DESC', [todoId]
    )
    return rows
  },

  async create(userId: number, data: CreateIdeaDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO ideas (user_id, content, source, todo_id) VALUES (?, ?, ?, ?)',
      [userId, data.content, data.source || 'text', data.todo_id || null]
    )
    return result.insertId
  },

  async update(id: number, userId: number, data: UpdateIdeaDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE ideas SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...values, id, userId]
    )
    return result.affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM ideas WHERE id = ? AND user_id = ?', [id, userId]
    )
    return result.affectedRows > 0
  },

  async linkToTodo(id: number, userId: number, todoId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'UPDATE ideas SET todo_id = ? WHERE id = ? AND user_id = ?',
      [todoId, id, userId]
    )
    return result.affectedRows > 0
  },

  async unlink(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'UPDATE ideas SET todo_id = NULL WHERE id = ? AND user_id = ?', [id, userId]
    )
    return result.affectedRows > 0
  },


}
