import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm'
import type { RowDataPacket } from 'mysql2'
import type { ChecklistItemRow, CreateChecklistItemDTO, UpdateChecklistItemDTO } from '~~/server/types'
import { checklistItems, checklistRecords } from '../../database/schema'

export const ChecklistModel = {
  // ==================== 习惯项 CRUD ====================

  async getItems(userId: number): Promise<ChecklistItemRow[]> {
    const rows = await getDb().select().from(checklistItems)
      .where(eq(checklistItems.user_id, userId))
      .orderBy(asc(checklistItems.sort_order), asc(checklistItems.id))
    return rows as unknown as ChecklistItemRow[]
  },

  async getItem(id: number, userId: number): Promise<ChecklistItemRow | null> {
    const rows = await getDb().select().from(checklistItems)
      .where(and(eq(checklistItems.id, id), eq(checklistItems.user_id, userId)))
    return (rows[0] as unknown as ChecklistItemRow) || null
  },

  async createItem(userId: number, data: CreateChecklistItemDTO): Promise<number> {
    // New item gets max sort_order + 1
    const [maxRow] = await getDb().select({ max: sql<number>`COALESCE(MAX(${checklistItems.sort_order}), -1)` })
      .from(checklistItems).where(eq(checklistItems.user_id, userId))
    const nextOrder = (maxRow?.max ?? -1) + 1

    const result = await getDb().insert(checklistItems).values({
      user_id: userId,
      title: data.title,
      icon: data.icon || '✅',
      sort_order: nextOrder,
    })
    return result[0].insertId
  },

  async updateItem(id: number, userId: number, data: UpdateChecklistItemDTO): Promise<boolean> {
    const setObj: Record<string, any> = {}
    if (data.title !== undefined) setObj.title = data.title
    if (data.icon !== undefined) setObj.icon = data.icon
    if (data.is_active !== undefined) setObj.is_active = data.is_active
    if (Object.keys(setObj).length === 0) return false

    const result = await getDb().update(checklistItems).set(setObj)
      .where(and(eq(checklistItems.id, id), eq(checklistItems.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async deleteItem(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(checklistItems)
      .where(and(eq(checklistItems.id, id), eq(checklistItems.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async reorderItems(userId: number, itemIds: number[]): Promise<void> {
    // Batch update sort_order using CASE
    if (itemIds.length === 0) return
    const pool = getPool()
    const cases = itemIds.map((id, idx) => `WHEN id = ${Number(id)} THEN ${idx}`).join(' ')
    await pool.query(
      `UPDATE checklist_items SET sort_order = CASE ${cases} ELSE sort_order END WHERE user_id = ? AND id IN (?)`,
      [userId, itemIds.map(Number)]
    )
  },

  // ==================== 打卡操作 ====================

  async checkIn(itemId: number, userId: number, date: string): Promise<void> {
    // INSERT IGNORE for idempotency
    const pool = getPool()
    await pool.query(
      'INSERT IGNORE INTO checklist_records (item_id, user_id, check_date, checked_at) VALUES (?, ?, ?, NOW())',
      [itemId, userId, date]
    )
  },

  async uncheckIn(itemId: number, userId: number, date: string): Promise<void> {
    await getDb().delete(checklistRecords)
      .where(and(
        eq(checklistRecords.item_id, itemId),
        eq(checklistRecords.user_id, userId),
        eq(checklistRecords.check_date, new Date(date)),
      ))
  },

  // ==================== 查询 ====================

  async getTodayItems(userId: number, date: string): Promise<any[]> {
    const pool = getPool()
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ci.id, ci.title, ci.icon, ci.sort_order, ci.is_active, ci.created_at, ci.updated_at,
              cr.checked_at,
              IF(cr.id IS NOT NULL, TRUE, FALSE) AS checked
       FROM checklist_items ci
       LEFT JOIN checklist_records cr ON ci.id = cr.item_id AND cr.check_date = ?
       WHERE ci.user_id = ? AND ci.is_active = 1
       ORDER BY ci.sort_order ASC, ci.id ASC`,
      [date, userId]
    )
    return rows
  },

  async getHistory(userId: number, startDate: string, endDate: string): Promise<RowDataPacket[]> {
    const pool = getPool()
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cr.check_date, cr.item_id, ci.title, ci.icon,
              TRUE AS checked
       FROM checklist_records cr
       INNER JOIN checklist_items ci ON cr.item_id = ci.id
       WHERE cr.user_id = ? AND cr.check_date BETWEEN ? AND ?
       ORDER BY cr.check_date DESC, ci.sort_order ASC`,
      [userId, startDate, endDate]
    )
    return rows
  },

  async getStats(userId: number, days: number): Promise<{
    overall: { total_days: number; perfect_days: number; overall_rate: number; current_streak: number; longest_streak: number }
    items: any[]
    heatmap: any[]
  }> {
    const pool = getPool()
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days + 1)
    const startStr = formatDate(startDate)
    const endStr = formatDate(endDate)

    // Get active items
    const [items] = await pool.query<RowDataPacket[]>(
      'SELECT id, title, icon, created_at FROM checklist_items WHERE user_id = ? AND is_active = 1 ORDER BY sort_order ASC',
      [userId]
    )
    if (items.length === 0) {
      return {
        overall: { total_days: 0, perfect_days: 0, overall_rate: 0, current_streak: 0, longest_streak: 0 },
        items: [],
        heatmap: [],
      }
    }

    // Get all records in range
    const itemIds = items.map((i: any) => i.id)
    const [records] = await pool.query<RowDataPacket[]>(
      'SELECT item_id, check_date FROM checklist_records WHERE user_id = ? AND check_date BETWEEN ? AND ? AND item_id IN (?)',
      [userId, startStr, endStr, itemIds]
    )

    // Build lookup: date → Set of checked item_ids
    const dateCheckedMap = new Map<string, Set<number>>()
    for (const r of records) {
      const d = formatDate(new Date(r.check_date))
      if (!dateCheckedMap.has(d)) dateCheckedMap.set(d, new Set())
      dateCheckedMap.get(d)!.add(r.item_id)
    }

    // Per-item stats
    const itemStats = items.map((item: any) => {
      const itemCreated = formatDate(new Date(item.created_at))
      let checkedDays = 0
      let totalDays = 0
      // Streak calculation
      let currentStreak = 0
      let longestStreak = 0
      let streak = 0
      let streakBroken = false

      // Iterate days from endDate backwards
      for (let d = new Date(endDate); d >= startDate; d.setDate(d.getDate() - 1)) {
        const ds = formatDate(d)
        if (ds < itemCreated) break // Don't count before item creation
        totalDays++
        const checked = dateCheckedMap.get(ds)?.has(item.id) || false
        if (checked) {
          checkedDays++
          if (!streakBroken) { currentStreak++; streak++ }
          else streak++
        } else {
          if (!streakBroken) { streakBroken = true; longestStreak = Math.max(longestStreak, streak); streak = 0 }
          else { longestStreak = Math.max(longestStreak, streak); streak = 0 }
        }
      }
      longestStreak = Math.max(longestStreak, streak)
      if (!streakBroken) longestStreak = Math.max(longestStreak, currentStreak)

      return {
        item_id: item.id,
        title: item.title,
        icon: item.icon,
        checked_days: checkedDays,
        total_days: totalDays,
        completion_rate: totalDays > 0 ? Math.round(checkedDays / totalDays * 1000) / 10 : 0,
        current_streak: currentStreak,
        longest_streak: longestStreak,
      }
    })

    // Heatmap + overall perfect days
    const heatmap: any[] = []
    let perfectDays = 0
    let totalChecks = 0
    let totalPossible = 0

    // Overall streak (all items completed each day)
    let overallCurrentStreak = 0
    let overallLongestStreak = 0
    let overallStreak = 0
    let overallBroken = false

    for (let d = new Date(endDate); d >= startDate; d.setDate(d.getDate() - 1)) {
      const ds = formatDate(d)
      // Count active items on this day (created before or on this day)
      const activeItems = items.filter((item: any) => formatDate(new Date(item.created_at)) <= ds)
      const total = activeItems.length
      if (total === 0) continue
      const checkedSet = dateCheckedMap.get(ds) || new Set()
      const checked = activeItems.filter((item: any) => checkedSet.has(item.id)).length

      heatmap.push({ date: ds, total, checked, rate: Math.round(checked / total * 1000) / 10 })

      totalChecks += checked
      totalPossible += total
      if (checked === total) {
        perfectDays++
        if (!overallBroken) overallCurrentStreak++
        overallStreak++
      } else {
        if (!overallBroken) { overallBroken = true; overallLongestStreak = Math.max(overallLongestStreak, overallStreak); overallStreak = 0 }
        else { overallLongestStreak = Math.max(overallLongestStreak, overallStreak); overallStreak = 0 }
      }
    }
    overallLongestStreak = Math.max(overallLongestStreak, overallStreak)
    if (!overallBroken) overallLongestStreak = Math.max(overallLongestStreak, overallCurrentStreak)

    return {
      overall: {
        total_days: days,
        perfect_days: perfectDays,
        overall_rate: totalPossible > 0 ? Math.round(totalChecks / totalPossible * 1000) / 10 : 0,
        current_streak: overallCurrentStreak,
        longest_streak: overallLongestStreak,
      },
      items: itemStats,
      heatmap: heatmap.reverse(), // chronological order
    }
  },
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
