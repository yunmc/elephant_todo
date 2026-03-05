import { eq, and } from 'drizzle-orm'
import type { AiReportRow } from '~~/server/types'
import { aiReports } from '../../database/schema'

export const AiReportModel = {
  async getCached(userId: number, type: 'monthly' | 'yearly', year: number, month?: number): Promise<AiReportRow | null> {
    const m = type === 'yearly' ? 0 : (month ?? 0)
    const rows = await getDb().select().from(aiReports)
      .where(and(
        eq(aiReports.user_id, userId),
        eq(aiReports.report_type, type),
        eq(aiReports.year, year),
        eq(aiReports.month, m),
      ))
    return (rows[0] as unknown as AiReportRow) || null
  },

  async saveReport(userId: number, type: 'monthly' | 'yearly', year: number, month: number, content: object): Promise<number> {
    // REPLACE INTO is not supported by Drizzle, use raw pool
    const [result] = await getPool().query<any>(
      'REPLACE INTO ai_reports (user_id, report_type, year, month, content) VALUES (?, ?, ?, ?, ?)',
      [userId, type, year, month, JSON.stringify(content)],
    )
    return result.insertId
  },

  async deleteCache(userId: number, type: 'monthly' | 'yearly', year: number, month?: number): Promise<void> {
    const m = type === 'yearly' ? 0 : (month ?? 0)
    await getDb().delete(aiReports)
      .where(and(
        eq(aiReports.user_id, userId),
        eq(aiReports.report_type, type),
        eq(aiReports.year, year),
        eq(aiReports.month, m),
      ))
  },
}
