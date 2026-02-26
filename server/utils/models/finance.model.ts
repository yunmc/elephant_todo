import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type {
  FinanceCategoryRow,
  CreateFinanceCategoryDTO,
  UpdateFinanceCategoryDTO,
  FinanceRecordRow,
  CreateFinanceRecordDTO,
  UpdateFinanceRecordDTO,
  FinanceQueryParams,
} from '~~/server/types'

// ==================== Finance Category Model ====================
export const FinanceCategoryModel = {
  async findByUser(userId: number): Promise<FinanceCategoryRow[]> {
    const [rows] = await getDb().query<FinanceCategoryRow[]>(
      'SELECT * FROM finance_categories WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC',
      [userId],
    )
    return rows
  },

  async findById(id: number, userId: number): Promise<FinanceCategoryRow | null> {
    const [rows] = await getDb().query<FinanceCategoryRow[]>(
      'SELECT * FROM finance_categories WHERE id = ? AND user_id = ?',
      [id, userId],
    )
    return rows[0] || null
  },

  async create(userId: number, data: CreateFinanceCategoryDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO finance_categories (user_id, name, icon, type, sort_order) VALUES (?, ?, ?, ?, ?)',
      [userId, data.name, data.icon || '💰', data.type, data.sort_order || 0],
    )
    return result.insertId
  },

  async update(id: number, userId: number, data: UpdateFinanceCategoryDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon) }
    if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type) }
    if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE finance_categories SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...values, id, userId],
    )
    return result.affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM finance_categories WHERE id = ? AND user_id = ?',
      [id, userId],
    )
    return result.affectedRows > 0
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

    let whereClause = 'WHERE r.user_id = ?'
    const queryParams: any[] = [userId]

    if (params.type) {
      whereClause += ' AND r.type = ?'
      queryParams.push(params.type)
    }
    if (params.category_id) {
      whereClause += ' AND r.category_id = ?'
      queryParams.push(params.category_id)
    }
    if (params.start_date) {
      whereClause += ' AND r.record_date >= ?'
      queryParams.push(params.start_date)
    }
    if (params.end_date) {
      whereClause += ' AND r.record_date <= ?'
      queryParams.push(params.end_date)
    }

    const [countResult] = await getDb().query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM finance_records r ${whereClause}`,
      queryParams,
    )
    const total = countResult[0].total as number

    const [records] = await getDb().query<FinanceRecordRow[]>(
      `SELECT r.*, c.name as category_name, c.icon as category_icon
       FROM finance_records r
       LEFT JOIN finance_categories c ON r.category_id = c.id
       ${whereClause}
       ORDER BY r.record_date DESC, r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset],
    )

    return { records, total }
  },

  async findById(id: number, userId: number): Promise<FinanceRecordRow | null> {
    const [rows] = await getDb().query<FinanceRecordRow[]>(
      `SELECT r.*, c.name as category_name, c.icon as category_icon
       FROM finance_records r
       LEFT JOIN finance_categories c ON r.category_id = c.id
       WHERE r.id = ? AND r.user_id = ?`,
      [id, userId],
    )
    return rows[0] || null
  },

  async create(userId: number, data: CreateFinanceRecordDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO finance_records (user_id, category_id, type, amount, note, record_date) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, data.category_id || null, data.type, data.amount, data.note || null, data.record_date],
    )
    return result.insertId
  },

  async update(id: number, userId: number, data: UpdateFinanceRecordDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.category_id !== undefined) { fields.push('category_id = ?'); values.push(data.category_id) }
    if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type) }
    if (data.amount !== undefined) { fields.push('amount = ?'); values.push(data.amount) }
    if (data.note !== undefined) { fields.push('note = ?'); values.push(data.note) }
    if (data.record_date !== undefined) { fields.push('record_date = ?'); values.push(data.record_date) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE finance_records SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...values, id, userId],
    )
    return result.affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM finance_records WHERE id = ? AND user_id = ?',
      [id, userId],
    )
    return result.affectedRows > 0
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
    // Totals
    const [totals] = await getDb().query<RowDataPacket[]>(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
       FROM finance_records
       WHERE user_id = ? AND record_date >= ? AND record_date <= ?`,
      [userId, startDate, endDate],
    )

    const totalIncome = Number(totals[0].total_income)
    const totalExpense = Number(totals[0].total_expense)

    // By category
    const [byCategory] = await getDb().query<RowDataPacket[]>(
      `SELECT
        r.category_id,
        COALESCE(c.name, '未分类') as category_name,
        COALESCE(c.icon, '💰') as category_icon,
        r.type,
        SUM(r.amount) as total
       FROM finance_records r
       LEFT JOIN finance_categories c ON r.category_id = c.id
       WHERE r.user_id = ? AND r.record_date >= ? AND r.record_date <= ?
       GROUP BY r.category_id, r.type
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
}
