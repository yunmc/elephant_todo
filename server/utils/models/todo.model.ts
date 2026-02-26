import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { TodoRow, CreateTodoDTO, UpdateTodoDTO, TodoQueryParams } from '~~/server/types'

const ALLOWED_SORT_BY = ['created_at', 'due_date', 'priority'] as const
const ALLOWED_SORT_ORDER = ['asc', 'desc'] as const
const MAX_LIMIT = 100

export const TodoModel = {
  async findByUser(userId: number, params: TodoQueryParams): Promise<{ todos: TodoRow[]; total: number }> {
    const page = Math.max(1, params.page || 1)
    const limit = Math.min(Math.max(1, params.limit || 20), MAX_LIMIT)
    const offset = (page - 1) * limit
    const sortBy = ALLOWED_SORT_BY.includes(params.sort_by as any) ? params.sort_by! : 'created_at'
    const sortOrder = ALLOWED_SORT_ORDER.includes(params.sort_order as any) ? params.sort_order! : 'desc'

    let whereClause = 'WHERE t.user_id = ?'
    const queryParams: any[] = [userId]

    if (params.status) { whereClause += ' AND t.status = ?'; queryParams.push(params.status) }
    if (params.priority) { whereClause += ' AND t.priority = ?'; queryParams.push(params.priority) }
    if (params.category_id) { whereClause += ' AND t.category_id = ?'; queryParams.push(params.category_id) }
    if (params.search) { whereClause += ' AND MATCH(t.title, t.description) AGAINST(? IN BOOLEAN MODE)'; queryParams.push(params.search) }
    if (params.due_filter === 'today') { whereClause += ' AND DATE(t.due_date) = CURDATE()' }
    else if (params.due_filter === 'week') { whereClause += ' AND t.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)' }
    else if (params.due_filter === 'overdue') { whereClause += ' AND t.due_date < NOW() AND t.status = "pending"' }
    if (params.due_date_start) { whereClause += ' AND t.due_date >= ?'; queryParams.push(params.due_date_start) }
    if (params.due_date_end) { whereClause += ' AND t.due_date <= ?'; queryParams.push(params.due_date_end) }
    if (params.tag_id) { whereClause += ' AND EXISTS (SELECT 1 FROM todo_tags tt WHERE tt.todo_id = t.id AND tt.tag_id = ?)'; queryParams.push(params.tag_id) }

    const [countResult] = await getDb().query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM todos t ${whereClause}`, queryParams
    )
    const total = countResult[0].total as number

    let orderClause: string
    if (sortBy === 'priority') {
      orderClause = `FIELD(t.priority, 'high', 'medium', 'low') ${sortOrder}`
    } else {
      orderClause = `t.${sortBy} ${sortOrder}`
    }

    const [todos] = await getDb().query<TodoRow[]>(
      `SELECT t.*, c.name AS category_name, c.color AS category_color FROM todos t LEFT JOIN categories c ON t.category_id = c.id ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )

    return { todos, total }
  },

  async findById(id: number, userId: number): Promise<TodoRow | null> {
    const [rows] = await getDb().query<TodoRow[]>(
      'SELECT * FROM todos WHERE id = ? AND user_id = ?', [id, userId]
    )
    return rows[0] || null
  },

  async create(userId: number, data: CreateTodoDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO todos (user_id, title, description, priority, category_id, due_date) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, data.title, data.description || null, data.priority || 'medium', data.category_id || null, data.due_date || null]
    )
    return result.insertId
  },

  async update(id: number, userId: number, data: UpdateTodoDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title) }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description) }
    if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority) }
    if (data.category_id !== undefined) { fields.push('category_id = ?'); values.push(data.category_id) }
    if (data.due_date !== undefined) { fields.push('due_date = ?'); values.push(data.due_date) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE todos SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...values, id, userId]
    )
    return result.affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM todos WHERE id = ? AND user_id = ?', [id, userId]
    )
    return result.affectedRows > 0
  },

  async toggleStatus(id: number, userId: number): Promise<TodoRow | null> {
    await getDb().query(
      `UPDATE todos SET status = IF(status = 'pending', 'completed', 'pending'), completed_at = IF(status = 'pending', NOW(), NULL) WHERE id = ? AND user_id = ?`,
      [id, userId]
    )
    return this.findById(id, userId)
  },

  async updateTags(todoId: number, tagIds: number[]): Promise<void> {
    await getDb().query('DELETE FROM todo_tags WHERE todo_id = ?', [todoId])
    if (tagIds.length > 0) {
      const values = tagIds.map((tagId) => [todoId, tagId])
      await getDb().query('INSERT INTO todo_tags (todo_id, tag_id) VALUES ?', [values])
    }
  },

  async getTags(todoId: number): Promise<RowDataPacket[]> {
    const [rows] = await getDb().query<RowDataPacket[]>(
      'SELECT t.* FROM tags t JOIN todo_tags tt ON t.id = tt.tag_id WHERE tt.todo_id = ?', [todoId]
    )
    return rows
  },

  async getIdeasCount(todoId: number): Promise<number> {
    const [rows] = await getDb().query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM ideas WHERE todo_id = ?', [todoId]
    )
    return rows[0].count as number
  },

  /** Batch get tags for multiple todos (eliminates N+1) */
  async getTagsBatch(todoIds: number[]): Promise<Map<number, RowDataPacket[]>> {
    const result = new Map<number, RowDataPacket[]>()
    if (todoIds.length === 0) return result
    todoIds.forEach(id => result.set(id, []))

    const [rows] = await getDb().query<RowDataPacket[]>(
      'SELECT tt.todo_id, t.* FROM tags t JOIN todo_tags tt ON t.id = tt.tag_id WHERE tt.todo_id IN (?)',
      [todoIds]
    )
    for (const row of rows) {
      const list = result.get(row.todo_id)
      if (list) list.push(row)
    }
    return result
  },

  /** Batch get ideas count for multiple todos (eliminates N+1) */
  async getIdeasCountBatch(todoIds: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>()
    if (todoIds.length === 0) return result
    todoIds.forEach(id => result.set(id, 0))

    const [rows] = await getDb().query<RowDataPacket[]>(
      'SELECT todo_id, COUNT(*) as count FROM ideas WHERE todo_id IN (?) GROUP BY todo_id',
      [todoIds]
    )
    for (const row of rows) {
      result.set(row.todo_id, row.count as number)
    }
    return result
  },
}
