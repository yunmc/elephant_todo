import { eq, and, asc } from 'drizzle-orm'
import type {
  ImportantDateRow,
  CreateImportantDateDTO,
  UpdateImportantDateDTO,
} from '~~/server/types'
import { importantDates } from '../../database/schema'

export const ImportantDateModel = {
  async findByUser(userId: number): Promise<ImportantDateRow[]> {
    const rows = await getDb().select().from(importantDates)
      .where(eq(importantDates.user_id, userId))
      .orderBy(asc(importantDates.date))
    return rows as unknown as ImportantDateRow[]
  },

  async findById(id: number, userId: number): Promise<ImportantDateRow | null> {
    const rows = await getDb().select().from(importantDates)
      .where(and(eq(importantDates.id, id), eq(importantDates.user_id, userId)))
    return (rows[0] as unknown as ImportantDateRow) || null
  },

  async create(userId: number, data: CreateImportantDateDTO): Promise<number> {
    const result = await getDb().insert(importantDates).values({
      user_id: userId,
      title: data.title,
      date: data.date,
      is_lunar: data.is_lunar ?? false,
      repeat_type: data.repeat_type ?? 'none',
      remind_days_before: data.remind_days_before ?? 0,
      icon: data.icon || '📅',
      note: data.note || null,
    })
    return result[0].insertId
  },

  async update(id: number, userId: number, data: UpdateImportantDateDTO): Promise<boolean> {
    const setObj: Record<string, any> = {}
    if (data.title !== undefined) setObj.title = data.title
    if (data.date !== undefined) setObj.date = data.date
    if (data.is_lunar !== undefined) setObj.is_lunar = data.is_lunar
    if (data.repeat_type !== undefined) setObj.repeat_type = data.repeat_type
    if (data.remind_days_before !== undefined) setObj.remind_days_before = data.remind_days_before
    if (data.icon !== undefined) setObj.icon = data.icon
    if (data.note !== undefined) setObj.note = data.note
    if (Object.keys(setObj).length === 0) return false

    const result = await getDb().update(importantDates).set(setObj)
      .where(and(eq(importantDates.id, id), eq(importantDates.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(importantDates)
      .where(and(eq(importantDates.id, id), eq(importantDates.user_id, userId)))
    return result[0].affectedRows > 0
  },
}
