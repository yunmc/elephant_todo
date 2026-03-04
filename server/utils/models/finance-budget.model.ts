import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type {
  FinanceBudgetRow,
  CreateFinanceBudgetDTO,
  UpdateFinanceBudgetDTO,
} from '~~/server/types'

export const FinanceBudgetModel = {
  /** 获取用户某月所有预算 */
  async findByMonth(userId: number, yearMonth: string): Promise<FinanceBudgetRow[]> {
    const [rows] = await getDb().query<FinanceBudgetRow[]>(
      `SELECT b.*, c.name as category_name, c.icon as category_icon
       FROM finance_budgets b
       LEFT JOIN finance_categories c ON b.category_id = c.id
       WHERE b.user_id = ? AND b.year_month = ?
       ORDER BY b.category_id IS NULL DESC, c.name ASC`,
      [userId, yearMonth],
    )
    return rows
  },

  /** 获取单条预算 */
  async findById(id: number, userId: number): Promise<FinanceBudgetRow | null> {
    const [rows] = await getDb().query<FinanceBudgetRow[]>(
      `SELECT b.*, c.name as category_name, c.icon as category_icon
       FROM finance_budgets b
       LEFT JOIN finance_categories c ON b.category_id = c.id
       WHERE b.id = ? AND b.user_id = ?`,
      [id, userId],
    )
    return rows[0] || null
  },

  /** 创建或更新（UPSERT）预算 */
  async upsert(userId: number, data: CreateFinanceBudgetDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      `INSERT INTO finance_budgets (user_id, category_id, year_month, amount)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
      [userId, data.category_id ?? null, data.year_month, data.amount],
    )
    return result.insertId || result.affectedRows
  },

  /** 更新预算金额 */
  async update(id: number, userId: number, data: UpdateFinanceBudgetDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.amount !== undefined) { fields.push('amount = ?'); values.push(data.amount) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE finance_budgets SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...values, id, userId],
    )
    return result.affectedRows > 0
  },

  /** 删除预算 */
  async delete(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM finance_budgets WHERE id = ? AND user_id = ?',
      [id, userId],
    )
    return result.affectedRows > 0
  },

  /** 获取预算执行进度 */
  async getProgress(userId: number, yearMonth: string): Promise<{
    budgets: FinanceBudgetRow[]
    spending: { category_id: number | null; spent: number }[]
  }> {
    // 1. 获取所有预算
    const budgets = await this.findByMonth(userId, yearMonth)

    // 2. 获取当月各分类支出
    const [year, month] = yearMonth.split('-').map(Number)
    const startDate = `${yearMonth}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

    const [spending] = await getDb().query<RowDataPacket[]>(
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
