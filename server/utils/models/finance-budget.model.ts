import { eq, and, sql, count } from 'drizzle-orm'
import type { RowDataPacket } from 'mysql2'
import type {
  FinanceBudgetRow,
  CreateFinanceBudgetDTO,
  UpdateFinanceBudgetDTO,
} from '~~/server/types'
import { financeBudgets, financeCategories } from '../../database/schema'

export const FinanceBudgetModel = {
  async findByMonth(userId: number, yearMonth: string): Promise<FinanceBudgetRow[]> {
    const rows = await getDb().select({
      id: financeBudgets.id,
      user_id: financeBudgets.user_id,
      category_id: financeBudgets.category_id,
      year_month: financeBudgets.year_month,
      amount: financeBudgets.amount,
      created_at: financeBudgets.created_at,
      updated_at: financeBudgets.updated_at,
      category_name: financeCategories.name,
      category_icon: financeCategories.icon,
    }).from(financeBudgets)
      .leftJoin(financeCategories, eq(financeBudgets.category_id, financeCategories.id))
      .where(and(eq(financeBudgets.user_id, userId), eq(financeBudgets.year_month, yearMonth)))
      .orderBy(sql`${financeBudgets.category_id} IS NULL DESC`, financeCategories.name)
    return rows as unknown as FinanceBudgetRow[]
  },

  async findById(id: number, userId: number): Promise<FinanceBudgetRow | null> {
    const rows = await getDb().select({
      id: financeBudgets.id,
      user_id: financeBudgets.user_id,
      category_id: financeBudgets.category_id,
      year_month: financeBudgets.year_month,
      amount: financeBudgets.amount,
      created_at: financeBudgets.created_at,
      updated_at: financeBudgets.updated_at,
      category_name: financeCategories.name,
      category_icon: financeCategories.icon,
    }).from(financeBudgets)
      .leftJoin(financeCategories, eq(financeBudgets.category_id, financeCategories.id))
      .where(and(eq(financeBudgets.id, id), eq(financeBudgets.user_id, userId)))
    return (rows[0] as unknown as FinanceBudgetRow) || null
  },

  async upsert(userId: number, data: CreateFinanceBudgetDTO): Promise<number> {
    // ON DUPLICATE KEY UPDATE — use raw pool
    const [result] = await getPool().query<any>(
      `INSERT INTO finance_budgets (user_id, category_id, year_month, amount)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
      [userId, data.category_id ?? null, data.year_month, data.amount],
    )
    return result.insertId || result.affectedRows
  },

  async update(id: number, userId: number, data: UpdateFinanceBudgetDTO): Promise<boolean> {
    const setObj: Record<string, any> = {}
    if (data.amount !== undefined) setObj.amount = String(data.amount)
    if (Object.keys(setObj).length === 0) return false

    const result = await getDb().update(financeBudgets).set(setObj)
      .where(and(eq(financeBudgets.id, id), eq(financeBudgets.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const result = await getDb().delete(financeBudgets)
      .where(and(eq(financeBudgets.id, id), eq(financeBudgets.user_id, userId)))
    return result[0].affectedRows > 0
  },

  async getProgress(userId: number, yearMonth: string): Promise<{
    budgets: FinanceBudgetRow[]
    spending: { category_id: number | null; spent: number }[]
  }> {
    const budgets = await this.findByMonth(userId, yearMonth)

    const [year, month] = yearMonth.split('-').map(Number)
    const startDate = `${yearMonth}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

    const [spending] = await getPool().query<RowDataPacket[]>(
      `SELECT category_id, SUM(amount) as spent
       FROM finance_records
       WHERE user_id = ? AND type = 'expense' AND record_date >= ? AND record_date <= ?
       GROUP BY category_id`,
      [userId, startDate, endDate],
    )

    return {
      budgets,
      spending: spending.map((s: any) => ({
        category_id: s.category_id,
        spent: Number(s.spent),
      })),
    }
  },
}
