import { eq, and, sql, desc, count, isNull, isNotNull } from 'drizzle-orm'
import type { IdeaRow, CreateIdeaDTO, UpdateIdeaDTO, IdeaQueryParams } from '~~/server/types'
import { ideas, todos } from '../../database/schema'

const MAX_LIMIT = 100

function sanitizeFulltextSearch(input: string): string {
  return input.replace(/[+\-~*"()@<>]/g, ' ').replace(/\s+/g, ' ').trim()
}

export const IdeaModel = {
  async findByUser(userId: number, params: IdeaQueryParams): Promise<{ ideas: IdeaRow[]; total: number }> {
    const page = Math.max(1, params.page || 1)
    const limit = Math.min(Math.max(1, params.limit || 20), MAX_LIMIT)
    const offset = (page - 1) * limit

    const conditions: any[] = [eq(ideas.user_id, userId)]

    if (params.linked === 'true') conditions.push(isNotNull(ideas.todo_id))
    else if (params.linked === 'false') conditions.push(isNull(ideas.todo_id))
    if (params.source && ['text', 'voice'].includes(params.source)) {
      conditions.push(eq(ideas.source, params.source as 'text' | 'voice'))
    }

    // FULLTEXT search requires raw SQL
    let fulltextCondition: ReturnType<typeof sql> | null = null
    if (params.search) {
      const sanitized = sanitizeFulltextSearch(params.search)
      if (sanitized) {
        fulltextCondition = sql`MATCH(${ideas.content}) AGAINST(${sanitized} IN BOOLEAN MODE)`
      }
    }

    // Count query
    const whereCondition = fulltextCondition
      ? and(...conditions, fulltextCondition)
      : and(...conditions)

    const [countRow] = await getDb().select({ total: count() }).from(ideas)
      .where(whereCondition)
    const total = countRow.total

    // Data query with LEFT JOIN
    const rows = await getDb().select({
      id: ideas.id,
      user_id: ideas.user_id,
      todo_id: ideas.todo_id,
      content: ideas.content,
      source: ideas.source,
      embedding: ideas.embedding,
      created_at: ideas.created_at,
      updated_at: ideas.updated_at,
      todo_title: todos.title,
    }).from(ideas)
      .leftJoin(todos, eq(ideas.todo_id, todos.id))
      .where(whereCondition)
      .orderBy(desc(ideas.created_at))
      .limit(limit)
      .offset(offset)

    return { ideas: rows as unknown as IdeaRow[], total }
  },

  async findById(id: number, userId: number): Promise<IdeaRow | null> {
    const rows = await getDb().select({
      id: ideas.id,
      user_id: ideas.user_id,
      todo_id: ideas.todo_id,
      content: ideas.content,
      source: ideas.source,
      embedding: ideas.embedding,
      created_at: ideas.created_at,
      updated_at: ideas.updated_at,
      todo_title: todos.title,
    }).from(ideas)
      .leftJoin(todos, eq(ideas.todo_id, todos.id))
      .where(and(eq(ideas.id, id), eq(ideas.user_id, userId)))
    return (rows[0] as unknown as IdeaRow) || null
  },

  async findByTodoId(todoId: number): Promise<IdeaRow[]> {
    const rows = await getDb().select().from(ideas)
      .where(eq(ideas.todo_id, todoId))
      .orderBy(desc(ideas.created_at))
    return rows as unknown as IdeaRow[]
  },

  async create(userId: number, data: CreateIdeaDTO): Promise<number> {
    const result = await getDb().insert(ideas).values({
      user_id: userId,
      content: data.content,
      source: data.source || 'text',
      todo_id: data.todo_id || null,
    })
    return result[0].insertId
  },

  async update(id: number, userId: number, data: UpdateIdeaDTO): Promise<boolean> {
    const setObj: Record<string, any> = {}
    if (data.content !== undefined) setObj.content = data.content
    if (Object.keys(setObj).length === 0) return false

    const result = await getDb().update(ideas).set(setObj)
      .where(and(eq(ideas.id, id), eq(ideas.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(ideas)
      .where(and(eq(ideas.id, id), eq(ideas.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async linkToTodo(id: number, userId: number, todoId: number): Promise<boolean> {
    const result = await getDb().update(ideas).set({ todo_id: todoId })
      .where(and(eq(ideas.id, id), eq(ideas.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async unlink(id: number, userId: number): Promise<boolean> {
    const result = await getDb().update(ideas).set({ todo_id: null })
      .where(and(eq(ideas.id, id), eq(ideas.user_id, userId)))
    return result[0].affectedRows > 0
  },
}
