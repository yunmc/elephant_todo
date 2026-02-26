import type { ResultSetHeader } from 'mysql2'
import type {
  ImportantDateRow,
  CreateImportantDateDTO,
  UpdateImportantDateDTO,
} from '~~/server/types'

export const ImportantDateModel = {
  async findByUser(userId: number): Promise<ImportantDateRow[]> {
    const [rows] = await getDb().query<ImportantDateRow[]>(
      'SELECT * FROM important_dates WHERE user_id = ? ORDER BY date ASC',
      [userId],
    )
    return rows
  },

  async findById(id: number, userId: number): Promise<ImportantDateRow | null> {
    const [rows] = await getDb().query<ImportantDateRow[]>(
      'SELECT * FROM important_dates WHERE id = ? AND user_id = ?',
      [id, userId],
    )
    return rows[0] || null
  },

  async create(userId: number, data: CreateImportantDateDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO important_dates (user_id, title, date, is_lunar, repeat_yearly, remind_days_before, icon, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        data.title,
        data.date,
        data.is_lunar ?? false,
        data.repeat_yearly ?? true,
        data.remind_days_before ?? 0,
        data.icon || '📅',
        data.note || null,
      ],
    )
    return result.insertId
  },

  async update(id: number, userId: number, data: UpdateImportantDateDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title) }
    if (data.date !== undefined) { fields.push('date = ?'); values.push(data.date) }
    if (data.is_lunar !== undefined) { fields.push('is_lunar = ?'); values.push(data.is_lunar) }
    if (data.repeat_yearly !== undefined) { fields.push('repeat_yearly = ?'); values.push(data.repeat_yearly) }
    if (data.remind_days_before !== undefined) { fields.push('remind_days_before = ?'); values.push(data.remind_days_before) }
    if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon) }
    if (data.note !== undefined) { fields.push('note = ?'); values.push(data.note) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE important_dates SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...values, id, userId],
    )
    return result.affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM important_dates WHERE id = ? AND user_id = ?',
      [id, userId],
    )
    return result.affectedRows > 0
  },
}
