import type { ResultSetHeader } from 'mysql2'
import type { TagRow, CreateTagDTO, UpdateTagDTO } from '~~/server/types'

export const TagModel = {
  async findByUser(userId: number): Promise<TagRow[]> {
    const [rows] = await getDb().query<TagRow[]>(
      'SELECT * FROM tags WHERE user_id = ? ORDER BY created_at ASC', [userId]
    )
    return rows
  },

  async findById(id: number, userId: number): Promise<TagRow | null> {
    const [rows] = await getDb().query<TagRow[]>(
      'SELECT * FROM tags WHERE id = ? AND user_id = ?', [id, userId]
    )
    return rows[0] || null
  },

  async create(userId: number, data: CreateTagDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO tags (user_id, name) VALUES (?, ?)', [userId, data.name]
    )
    return result.insertId
  },

  async update(id: number, userId: number, data: UpdateTagDTO): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'UPDATE tags SET name = ? WHERE id = ? AND user_id = ?', [data.name, id, userId]
    )
    return result.affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM tags WHERE id = ? AND user_id = ?', [id, userId]
    )
    return result.affectedRows > 0
  },
}
