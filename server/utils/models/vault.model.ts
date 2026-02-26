import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type {
  VaultGroupRow, CreateVaultGroupDTO, UpdateVaultGroupDTO,
  VaultEntryRow, CreateVaultEntryDTO, UpdateVaultEntryDTO,
  VaultEntryBatchUpdateItem, VaultQueryParams,
} from '~~/server/types'

export const VaultModel = {
  // ==================== Groups ====================
  async findGroups(userId: number): Promise<VaultGroupRow[]> {
    const [rows] = await getDb().query<VaultGroupRow[]>(
      'SELECT * FROM vault_groups WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC', [userId]
    )
    return rows
  },

  async findGroupById(id: number, userId: number): Promise<VaultGroupRow | null> {
    const [rows] = await getDb().query<VaultGroupRow[]>(
      'SELECT * FROM vault_groups WHERE id = ? AND user_id = ?', [id, userId]
    )
    return rows[0] || null
  },

  async createGroup(userId: number, data: CreateVaultGroupDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO vault_groups (user_id, name, icon, sort_order) VALUES (?, ?, ?, ?)',
      [userId, data.name, data.icon || null, data.sort_order || 0]
    )
    return result.insertId
  },

  async updateGroup(id: number, userId: number, data: UpdateVaultGroupDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon) }
    if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE vault_groups SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...values, id, userId]
    )
    return result.affectedRows > 0
  },

  async deleteGroup(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM vault_groups WHERE id = ? AND user_id = ?', [id, userId]
    )
    return result.affectedRows > 0
  },

  // ==================== Entries ====================
  async findEntries(userId: number, params: VaultQueryParams): Promise<{ entries: VaultEntryRow[]; total: number }> {
    const page = params.page || 1
    const limit = params.limit || 20
    const offset = (page - 1) * limit

    let whereClause = 'WHERE user_id = ?'
    const queryParams: any[] = [userId]

    if (params.group_id) { whereClause += ' AND group_id = ?'; queryParams.push(params.group_id) }
    if (params.search) {
      whereClause += ' AND (name LIKE ? OR url LIKE ?)'
      const s = `%${params.search}%`
      queryParams.push(s, s)
    }

    const [countResult] = await getDb().query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM vault_entries ${whereClause}`, queryParams
    )
    const total = countResult[0].total as number

    const [entries] = await getDb().query<VaultEntryRow[]>(
      `SELECT * FROM vault_entries ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )

    return { entries, total }
  },

  async findEntryById(id: number, userId: number): Promise<VaultEntryRow | null> {
    const [rows] = await getDb().query<VaultEntryRow[]>(
      'SELECT * FROM vault_entries WHERE id = ? AND user_id = ?', [id, userId]
    )
    return rows[0] || null
  },

  async createEntry(userId: number, data: CreateVaultEntryDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO vault_entries (user_id, name, url, group_id, encrypted_data) VALUES (?, ?, ?, ?, ?)',
      [userId, data.name, data.url || null, data.group_id || null, data.encrypted_data]
    )
    return result.insertId
  },

  async updateEntry(id: number, userId: number, data: UpdateVaultEntryDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.url !== undefined) { fields.push('url = ?'); values.push(data.url) }
    if (data.group_id !== undefined) { fields.push('group_id = ?'); values.push(data.group_id) }
    if (data.encrypted_data !== undefined) { fields.push('encrypted_data = ?'); values.push(data.encrypted_data) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE vault_entries SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...values, id, userId]
    )
    return result.affectedRows > 0
  },

  async deleteEntry(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM vault_entries WHERE id = ? AND user_id = ?', [id, userId]
    )
    return result.affectedRows > 0
  },

  async batchUpdateEntries(userId: number, items: VaultEntryBatchUpdateItem[]): Promise<number> {
    const connection = await getDb().getConnection()
    try {
      await connection.beginTransaction()
      let updated = 0
      for (const item of items) {
        const [result] = await connection.query<ResultSetHeader>(
          'UPDATE vault_entries SET encrypted_data = ? WHERE id = ? AND user_id = ?',
          [item.encrypted_data, item.id, userId]
        )
        updated += result.affectedRows
      }
      await connection.commit()
      return updated
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  },
}
