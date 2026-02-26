import type { ResultSetHeader } from 'mysql2'
import type { CategoryRow, CreateCategoryDTO, UpdateCategoryDTO } from '~~/server/types'

export const CategoryModel = {
  async findByUser(userId: number): Promise<CategoryRow[]> {
    const [rows] = await getDb().query<CategoryRow[]>(
      'SELECT * FROM categories WHERE user_id = ? ORDER BY created_at ASC', [userId]
    )
    return rows
  },

  async findById(id: number, userId: number): Promise<CategoryRow | null> {
    const [rows] = await getDb().query<CategoryRow[]>(
      'SELECT * FROM categories WHERE id = ? AND user_id = ?', [id, userId]
    )
    return rows[0] || null
  },

  async create(userId: number, data: CreateCategoryDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)',
      [userId, data.name, data.color || '#999999']
    )
    return result.insertId
  },

  async update(id: number, userId: number, data: UpdateCategoryDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE categories SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...values, id, userId]
    )
    return result.affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM categories WHERE id = ? AND user_id = ?', [id, userId]
    )
    return result.affectedRows > 0
  },
}
