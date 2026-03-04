import type { ResultSetHeader } from 'mysql2'
import type { AiReportRow } from '~~/server/types'

export const AiReportModel = {
  /**
   * 获取缓存的报告
   */
  async getCached(userId: number, type: 'monthly' | 'yearly', year: number, month?: number): Promise<AiReportRow | null> {
    const m = type === 'yearly' ? 0 : (month ?? 0)
    const [rows] = await getDb().query<AiReportRow[]>(
      'SELECT * FROM ai_reports WHERE user_id = ? AND report_type = ? AND year = ? AND month = ?',
      [userId, type, year, m],
    )
    return rows[0] || null
  },

  /**
   * 保存报告缓存（使用 REPLACE INTO 覆盖已有记录）
   */
  async saveReport(userId: number, type: 'monthly' | 'yearly', year: number, month: number, content: object): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'REPLACE INTO ai_reports (user_id, report_type, year, month, content) VALUES (?, ?, ?, ?, ?)',
      [userId, type, year, month, JSON.stringify(content)],
    )
    return result.insertId
  },

  /**
   * 删除缓存（重新生成时）
   */
  async deleteCache(userId: number, type: 'monthly' | 'yearly', year: number, month?: number): Promise<void> {
    const m = type === 'yearly' ? 0 : (month ?? 0)
    await getDb().query(
      'DELETE FROM ai_reports WHERE user_id = ? AND report_type = ? AND year = ? AND month = ?',
      [userId, type, year, m],
    )
  },
}
