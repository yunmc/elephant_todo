import { eq, and, like, desc, count, sql } from 'drizzle-orm'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type {
  VaultGroupRow, CreateVaultGroupDTO, UpdateVaultGroupDTO,
  VaultEntryRow, CreateVaultEntryDTO, UpdateVaultEntryDTO,
  VaultEntryBatchUpdateItem, VaultQueryParams,
} from '~~/server/types'
import { vaultGroups, vaultEntries } from '../../database/schema'

export const VaultModel = {
  // ==================== Groups ====================
  async findGroups(userId: number): Promise<VaultGroupRow[]> {
    const rows = await getDb().select().from(vaultGroups)
      .where(eq(vaultGroups.user_id, userId))
      .orderBy(vaultGroups.sort_order, vaultGroups.created_at)
    return rows as unknown as VaultGroupRow[]
  },

  async findGroupById(id: number, userId: number): Promise<VaultGroupRow | null> {
    const rows = await getDb().select().from(vaultGroups)
      .where(and(eq(vaultGroups.id, id), eq(vaultGroups.user_id, userId)))
    return (rows[0] as unknown as VaultGroupRow) || null
  },

  async createGroup(userId: number, data: CreateVaultGroupDTO): Promise<number> {
    const result = await getDb().insert(vaultGroups).values({
      user_id: userId,
      name: data.name,
      icon: data.icon || null,
      sort_order: data.sort_order || 0,
    })
    return result[0].insertId
  },

  async updateGroup(id: number, userId: number, data: UpdateVaultGroupDTO): Promise<boolean> {
    const setObj: Record<string, any> = {}
    if (data.name !== undefined) setObj.name = data.name
    if (data.icon !== undefined) setObj.icon = data.icon
    if (data.sort_order !== undefined) setObj.sort_order = data.sort_order
    if (Object.keys(setObj).length === 0) return false

    const result = await getDb().update(vaultGroups).set(setObj)
      .where(and(eq(vaultGroups.id, id), eq(vaultGroups.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async deleteGroup(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(vaultGroups)
      .where(and(eq(vaultGroups.id, id), eq(vaultGroups.user_id, userId)))
    return result[0].affectedRows > 0
  },

  // ==================== Entries ====================
  async findEntries(userId: number, params: VaultQueryParams): Promise<{ entries: VaultEntryRow[]; total: number }> {
    const page = params.page || 1
    const limit = params.limit || 20
    const offset = (page - 1) * limit

    // Build conditions
    const conditions: any[] = [eq(vaultEntries.user_id, userId)]
    if (params.group_id) conditions.push(eq(vaultEntries.group_id, params.group_id))
    if (params.search) {
      const escaped = params.search.replace(/[%_\\]/g, '\\$&')
      const s = `%${escaped}%`
      conditions.push(sql`(${vaultEntries.name} LIKE ${s} OR ${vaultEntries.url} LIKE ${s})`)
    }
    const where = and(...conditions)

    const [totalRow] = await getDb().select({ total: count() }).from(vaultEntries).where(where)
    const total = totalRow.total

    const entries = await getDb().select().from(vaultEntries)
      .where(where)
      .orderBy(desc(vaultEntries.created_at))
      .limit(limit)
      .offset(offset)

    return { entries: entries as unknown as VaultEntryRow[], total }
  },

  async findEntryById(id: number, userId: number): Promise<VaultEntryRow | null> {
    const rows = await getDb().select().from(vaultEntries)
      .where(and(eq(vaultEntries.id, id), eq(vaultEntries.user_id, userId)))
    return (rows[0] as unknown as VaultEntryRow) || null
  },

  async createEntry(userId: number, data: CreateVaultEntryDTO): Promise<number> {
    const result = await getDb().insert(vaultEntries).values({
      user_id: userId,
      name: data.name,
      url: data.url || null,
      group_id: data.group_id || null,
      encrypted_data: data.encrypted_data,
    })
    return result[0].insertId
  },

  async updateEntry(id: number, userId: number, data: UpdateVaultEntryDTO): Promise<boolean> {
    const setObj: Record<string, any> = {}
    if (data.name !== undefined) setObj.name = data.name
    if (data.url !== undefined) setObj.url = data.url
    if (data.group_id !== undefined) setObj.group_id = data.group_id
    if (data.encrypted_data !== undefined) setObj.encrypted_data = data.encrypted_data
    if (Object.keys(setObj).length === 0) return false

    const result = await getDb().update(vaultEntries).set(setObj)
      .where(and(eq(vaultEntries.id, id), eq(vaultEntries.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async deleteEntry(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(vaultEntries)
      .where(and(eq(vaultEntries.id, id), eq(vaultEntries.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async batchUpdateEntries(userId: number, items: VaultEntryBatchUpdateItem[]): Promise<number> {
    const connection = await getPool().getConnection()
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
