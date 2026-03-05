import { eq, and, sql, desc, asc, count, inArray } from 'drizzle-orm'
import type { RowDataPacket } from 'mysql2'
import type { TodoRow, CreateTodoDTO, UpdateTodoDTO, TodoQueryParams } from '~~/server/types'
import { todos, categories, todoTags, tags, ideas } from '../../database/schema'

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

    // Build dynamic WHERE — raw SQL for complex features like FULLTEXT and FIELD()
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

    const pool = getPool()

    const [countResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM todos t ${whereClause}`, queryParams
    )
    const total = countResult[0].total as number

    let orderClause: string
    if (sortBy === 'priority') {
      orderClause = `FIELD(t.priority, 'high', 'medium', 'low') ${sortOrder}`
    } else {
      orderClause = `t.${sortBy} ${sortOrder}`
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, c.name AS category_name, c.color AS category_color FROM todos t LEFT JOIN categories c ON t.category_id = c.id ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )

    return { todos: rows as unknown as TodoRow[], total }
  },

  async findById(id: number, userId: number): Promise<TodoRow | null> {
    const rows = await getDb().select().from(todos)
      .where(and(eq(todos.id, id), eq(todos.user_id, userId)))
    return (rows[0] as unknown as TodoRow) || null
  },

  async create(userId: number, data: CreateTodoDTO): Promise<number> {
    const result = await getDb().insert(todos).values({
      user_id: userId,
      title: data.title,
      description: data.description || null,
      priority: data.priority || 'medium',
      category_id: data.category_id || null,
      due_date: data.due_date || null,
    })
    return result[0].insertId
  },

  async update(id: number, userId: number, data: UpdateTodoDTO): Promise<boolean> {
    const setObj: Record<string, any> = {}
    if (data.title !== undefined) setObj.title = data.title
    if (data.description !== undefined) setObj.description = data.description
    if (data.priority !== undefined) setObj.priority = data.priority
    if (data.category_id !== undefined) setObj.category_id = data.category_id
    if (data.due_date !== undefined) setObj.due_date = data.due_date
    if (Object.keys(setObj).length === 0) return false

    const result = await getDb().update(todos).set(setObj)
      .where(and(eq(todos.id, id), eq(todos.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(todos)
      .where(and(eq(todos.id, id), eq(todos.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async toggleStatus(id: number, userId: number): Promise<TodoRow | null> {
    await getDb().update(todos)
      .set({
        status: sql`IF(${todos.status} = 'pending', 'completed', 'pending')`,
        completed_at: sql`IF(${todos.status} = 'pending', NOW(), NULL)`,
      })
      .where(and(eq(todos.id, id), eq(todos.user_id, userId)))
    return this.findById(id, userId)
  },

  async updateTags(todoId: number, tagIds: number[]): Promise<void> {
    await getDb().delete(todoTags).where(eq(todoTags.todo_id, todoId))
    if (tagIds.length > 0) {
      await getDb().insert(todoTags).values(
        tagIds.map(tagId => ({ todo_id: todoId, tag_id: tagId }))
      )
    }
  },

  async getTags(todoId: number): Promise<RowDataPacket[]> {
    const rows = await getDb().select({
      id: tags.id,
      user_id: tags.user_id,
      name: tags.name,
      created_at: tags.created_at,
    }).from(tags)
      .innerJoin(todoTags, eq(tags.id, todoTags.tag_id))
      .where(eq(todoTags.todo_id, todoId))
    return rows as unknown as RowDataPacket[]
  },

  async getIdeasCount(todoId: number): Promise<number> {
    const [row] = await getDb().select({ count: count() }).from(ideas)
      .where(eq(ideas.todo_id, todoId))
    return row.count
  },

  async getTagsBatch(todoIds: number[]): Promise<Map<number, RowDataPacket[]>> {
    const result = new Map<number, RowDataPacket[]>()
    if (todoIds.length === 0) return result
    todoIds.forEach(id => result.set(id, []))

    const rows = await getDb().select({
      todo_id: todoTags.todo_id,
      id: tags.id,
      user_id: tags.user_id,
      name: tags.name,
      created_at: tags.created_at,
    }).from(tags)
      .innerJoin(todoTags, eq(tags.id, todoTags.tag_id))
      .where(inArray(todoTags.todo_id, todoIds))

    for (const row of rows) {
      const list = result.get(row.todo_id)
      if (list) list.push(row as unknown as RowDataPacket)
    }
    return result
  },

  async getIdeasCountBatch(todoIds: number[]): Promise<Map<number, number>> {
    const result = new Map<number, number>()
    if (todoIds.length === 0) return result
    todoIds.forEach(id => result.set(id, 0))

    const rows = await getDb().select({
      todo_id: ideas.todo_id,
      count: count(),
    }).from(ideas)
      .where(inArray(ideas.todo_id, todoIds))
      .groupBy(ideas.todo_id)

    for (const row of rows) {
      if (row.todo_id !== null) result.set(row.todo_id, row.count)
    }
    return result
  },
}
