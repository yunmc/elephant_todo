import { eq, and, asc } from 'drizzle-orm'
import type { CategoryRow, CreateCategoryDTO, UpdateCategoryDTO } from '~~/server/types'
import { categories } from '../../database/schema'

export const CategoryModel = {
  async findByUser(userId: number): Promise<CategoryRow[]> {
    const rows = await getDb().select().from(categories)
      .where(eq(categories.user_id, userId))
      .orderBy(asc(categories.created_at))
    return rows as unknown as CategoryRow[]
  },

  async findById(id: number, userId: number): Promise<CategoryRow | null> {
    const rows = await getDb().select().from(categories)
      .where(and(eq(categories.id, id), eq(categories.user_id, userId)))
    return (rows[0] as unknown as CategoryRow) || null
  },

  async create(userId: number, data: CreateCategoryDTO): Promise<number> {
    const result = await getDb().insert(categories).values({
      user_id: userId,
      name: data.name,
      color: data.color || '#999999',
    })
    return result[0].insertId
  },

  async update(id: number, userId: number, data: UpdateCategoryDTO): Promise<boolean> {
    const setObj: Record<string, any> = {}
    if (data.name !== undefined) setObj.name = data.name
    if (data.color !== undefined) setObj.color = data.color
    if (Object.keys(setObj).length === 0) return false

    const result = await getDb().update(categories).set(setObj)
      .where(and(eq(categories.id, id), eq(categories.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(categories)
      .where(and(eq(categories.id, id), eq(categories.user_id, userId)))
    return result[0].affectedRows > 0
  },
}
