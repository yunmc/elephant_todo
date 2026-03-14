import { eq, and, asc, desc, sql, count } from 'drizzle-orm'
import type { RowDataPacket } from 'mysql2'
import type {
  FinanceCategoryRow,
  CreateFinanceCategoryDTO,
  UpdateFinanceCategoryDTO,
  FinanceRecordRow,
  CreateFinanceRecordDTO,
  UpdateFinanceRecordDTO,
  FinanceQueryParams,
} from '~~/server/types'
import { financeCategories, financeRecords } from '../../database/schema'

// ==================== Finance Category Model ====================
export const FinanceCategoryModel = {
  async findByUser(userId: number): Promise<FinanceCategoryRow[]> {
    const rows = await getDb().select().from(financeCategories)
      .where(eq(financeCategories.user_id, userId))
      .orderBy(asc(financeCategories.sort_order), asc(financeCategories.created_at))
    return rows as unknown as FinanceCategoryRow[]
  },

  async findById(id: number, userId: number): Promise<FinanceCategoryRow | null> {
    const rows = await getDb().select().from(financeCategories)
      .where(and(eq(financeCategories.id, id), eq(financeCategories.user_id, userId)))
    return (rows[0] as unknown as FinanceCategoryRow) || null
  },

  async create(userId: number, data: CreateFinanceCategoryDTO): Promise<number> {
    const result = await getDb().insert(financeCategories).values({
      user_id: userId,
      name: data.name,
      icon: data.icon || '💰',
      type: data.type,
      sort_order: data.sort_order || 0,
    })
    return result[0].insertId
  },

  async update(id: number, userId: number, data: UpdateFinanceCategoryDTO): Promise<boolean> {
    const setObj: Record<string, any> = {}
    if (data.name !== undefined) setObj.name = data.name
    if (data.icon !== undefined) setObj.icon = data.icon
    if (data.type !== undefined) setObj.type = data.type
    if (data.sort_order !== undefined) setObj.sort_order = data.sort_order
    if (Object.keys(setObj).length === 0) return false

    const result = await getDb().update(financeCategories).set(setObj)
      .where(and(eq(financeCategories.id, id), eq(financeCategories.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(financeCategories)
      .where(and(eq(financeCategories.id, id), eq(financeCategories.user_id, userId)))
    return result[0].affectedRows > 0
  },
}

// ==================== Finance Record Model ====================
export const FinanceRecordModel = {
  async findByUser(
    userId: number,
    params: FinanceQueryParams,
  ): Promise<{ records: FinanceRecordRow[]; total: number }> {
    const page = params.page || 1
    const limit = params.limit || 50
    const offset = (page - 1) * limit

    const conditions: any[] = [eq(financeRecords.user_id, userId)]
    if (params.type) conditions.push(eq(financeRecords.type, params.type))
    if (params.category_id !== undefined && params.category_id !== null) {
      conditions.push(eq(financeRecords.category_id, params.category_id))
    }
    if (params.start_date) conditions.push(sql`${financeRecords.record_date} >= ${params.start_date}`)
    if (params.end_date) conditions.push(sql`${financeRecords.record_date} <= ${params.end_date}`)

    const whereCondition = and(...conditions)

    const [countRow] = await getDb().select({ total: count() }).from(financeRecords)
      .where(whereCondition)
    const total = countRow.total

    const rows = await getDb().select({
      id: financeRecords.id,
      user_id: financeRecords.user_id,
      category_id: financeRecords.category_id,
      type: financeRecords.type,
      amount: financeRecords.amount,
      note: financeRecords.note,
      record_date: financeRecords.record_date,
      created_at: financeRecords.created_at,
      updated_at: financeRecords.updated_at,
      category_name: financeCategories.name,
      category_icon: financeCategories.icon,
    }).from(financeRecords)
      .leftJoin(financeCategories, eq(financeRecords.category_id, financeCategories.id))
      .where(whereCondition)
      .orderBy(desc(financeRecords.record_date), desc(financeRecords.created_at))
      .limit(limit)
      .offset(offset)

    return { records: rows as unknown as FinanceRecordRow[], total }
  },

  async findById(id: number, userId: number): Promise<FinanceRecordRow | null> {
    const rows = await getDb().select({
      id: financeRecords.id,
      user_id: financeRecords.user_id,
      category_id: financeRecords.category_id,
      type: financeRecords.type,
      amount: financeRecords.amount,
      note: financeRecords.note,
      record_date: financeRecords.record_date,
      created_at: financeRecords.created_at,
      updated_at: financeRecords.updated_at,
      category_name: financeCategories.name,
      category_icon: financeCategories.icon,
    }).from(financeRecords)
      .leftJoin(financeCategories, eq(financeRecords.category_id, financeCategories.id))
      .where(and(eq(financeRecords.id, id), eq(financeRecords.user_id, userId)))
    return (rows[0] as unknown as FinanceRecordRow) || null
  },

  async create(userId: number, data: CreateFinanceRecordDTO): Promise<number> {
    const result = await getDb().insert(financeRecords).values({
      user_id: userId,
      category_id: data.category_id || null,
      type: data.type,
      amount: String(data.amount),
      note: data.note || null,
      record_date: data.record_date,
    })
    return result[0].insertId
  },

  async update(id: number, userId: number, data: UpdateFinanceRecordDTO): Promise<boolean> {
    const setObj: Record<string, any> = {}
    if (data.category_id !== undefined) setObj.category_id = data.category_id
    if (data.type !== undefined) setObj.type = data.type
    if (data.amount !== undefined) setObj.amount = String(data.amount)
    if (data.note !== undefined) setObj.note = data.note
    if (data.record_date !== undefined) setObj.record_date = data.record_date
    if (Object.keys(setObj).length === 0) return false

    const result = await getDb().update(financeRecords).set(setObj)
      .where(and(eq(financeRecords.id, id), eq(financeRecords.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(financeRecords)
      .where(and(eq(financeRecords.id, id), eq(financeRecords.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async getStatistics(
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<{
    total_income: number
    total_expense: number
    balance: number
    by_category: RowDataPacket[]
  }> {
    // Use raw SQL for complex aggregation with CASE
    const pool = getPool()
    const [totals] = await pool.query<RowDataPacket[]>(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
       FROM finance_records
       WHERE user_id = ? AND record_date >= ? AND record_date <= ?`,
      [userId, startDate, endDate],
    )

    const totalIncome = Number(totals[0].total_income)
    const totalExpense = Number(totals[0].total_expense)

    const [byCategory] = await pool.query<RowDataPacket[]>(
      `SELECT
        r.category_id,
        COALESCE(c.name, '未分类') as category_name,
        COALESCE(c.icon, '💰') as category_icon,
        r.type,
        SUM(r.amount) as total
       FROM finance_records r
       LEFT JOIN finance_categories c ON r.category_id = c.id
       WHERE r.user_id = ? AND r.record_date >= ? AND r.record_date <= ?
       GROUP BY r.category_id, c.name, c.icon, r.type
       ORDER BY total DESC`,
      [userId, startDate, endDate],
    )

    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      balance: totalIncome - totalExpense,
      by_category: byCategory,
    }
  },

  async getTrend(
    userId: number,
    startDate: string,
    endDate: string,
  ): Promise<{ month: string; income: number; expense: number }[]> {
    const pool = getPool()
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        DATE_FORMAT(record_date, '%Y-%m') AS month,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
       FROM finance_records
       WHERE user_id = ?
         AND record_date >= ?
         AND record_date <= ?
       GROUP BY DATE_FORMAT(record_date, '%Y-%m')
       ORDER BY month ASC`,
      [userId, startDate, endDate],
    )
    return rows.map(r => ({
      month: r.month,
      income: Number(r.income),
      expense: Number(r.expense),
    }))
  },
}
