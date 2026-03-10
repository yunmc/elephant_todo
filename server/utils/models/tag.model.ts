import { eq, and, asc } from 'drizzle-orm'
import type { TagRow, CreateTagDTO, UpdateTagDTO } from '~~/server/types'
import { tags } from '../../database/schema'

export const TagModel = {
  async findByUser(userId: number): Promise<TagRow[]> {
    const rows = await getDb().select().from(tags)
      .where(eq(tags.user_id, userId))
      .orderBy(asc(tags.created_at))
    return rows as unknown as TagRow[]
  },

  async findById(id: number, userId: number): Promise<TagRow | null> {
    const rows = await getDb().select().from(tags)
      .where(and(eq(tags.id, id), eq(tags.user_id, userId)))
    return (rows[0] as unknown as TagRow) || null
  },

  async create(userId: number, data: CreateTagDTO): Promise<number> {
    const result = await getDb().insert(tags).values({
      user_id: userId,
      name: data.name,
      ...(data.color ? { color: data.color } : {}),
    })
    return result[0].insertId
  },

  async update(id: number, userId: number, data: UpdateTagDTO): Promise<boolean> {
    const setData: Record<string, string> = { name: data.name }
    if (data.color !== undefined) setData.color = data.color
    const result = await getDb().update(tags).set(setData)
      .where(and(eq(tags.id, id), eq(tags.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(tags)
      .where(and(eq(tags.id, id), eq(tags.user_id, userId)))
    return result[0].affectedRows > 0
  },
}
