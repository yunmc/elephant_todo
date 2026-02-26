import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type {
  PeriodRecordRow,
  CreatePeriodRecordDTO,
  UpdatePeriodRecordDTO,
} from '~~/server/types'

export const PeriodModel = {
  async findByUser(userId: number): Promise<PeriodRecordRow[]> {
    const [rows] = await getDb().query<PeriodRecordRow[]>(
      'SELECT * FROM period_records WHERE user_id = ? ORDER BY start_date DESC',
      [userId],
    )
    return rows
  },

  async findById(id: number, userId: number): Promise<PeriodRecordRow | null> {
    const [rows] = await getDb().query<PeriodRecordRow[]>(
      'SELECT * FROM period_records WHERE id = ? AND user_id = ?',
      [id, userId],
    )
    return rows[0] || null
  },

  async create(userId: number, data: CreatePeriodRecordDTO): Promise<number> {
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO period_records (user_id, start_date, end_date, flow_level, symptoms, mood, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        data.start_date,
        data.end_date || null,
        data.flow_level || 'moderate',
        data.symptoms ? JSON.stringify(data.symptoms) : null,
        data.mood || null,
        data.note || null,
      ],
    )

    // Auto-calculate cycle_length and period_length
    await this.recalculateCycleLengths(userId)

    return result.insertId
  },

  async update(id: number, userId: number, data: UpdatePeriodRecordDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.start_date !== undefined) { fields.push('start_date = ?'); values.push(data.start_date) }
    if (data.end_date !== undefined) { fields.push('end_date = ?'); values.push(data.end_date) }
    if (data.flow_level !== undefined) { fields.push('flow_level = ?'); values.push(data.flow_level) }
    if (data.symptoms !== undefined) { fields.push('symptoms = ?'); values.push(JSON.stringify(data.symptoms)) }
    if (data.mood !== undefined) { fields.push('mood = ?'); values.push(data.mood) }
    if (data.note !== undefined) { fields.push('note = ?'); values.push(data.note) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE period_records SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...values, id, userId],
    )

    if (result.affectedRows > 0) {
      await this.recalculateCycleLengths(userId)
    }

    return result.affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM period_records WHERE id = ? AND user_id = ?',
      [id, userId],
    )
    if (result.affectedRows > 0) {
      await this.recalculateCycleLengths(userId)
    }
    return result.affectedRows > 0
  },

  /**
   * Recalculate cycle_length and period_length for all records of a user.
   * cycle_length = days between this record's start_date and the next record's start_date
   * period_length = days between start_date and end_date (if end_date is set)
   */
  async recalculateCycleLengths(userId: number): Promise<void> {
    const records = await this.findByUser(userId) // sorted DESC by start_date

    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      let cycleLength: number | null = null
      let periodLength: number | null = null

      // cycle_length: distance from this start to the next (newer) record's start
      if (i > 0) {
        const newerRecord = records[i - 1]
        const diffMs = new Date(newerRecord.start_date).getTime() - new Date(record.start_date).getTime()
        cycleLength = Math.round(diffMs / (1000 * 60 * 60 * 24))
      }

      // period_length: if end_date is set
      if (record.end_date) {
        const diffMs = new Date(record.end_date).getTime() - new Date(record.start_date).getTime()
        periodLength = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1 // inclusive
      }

      await getDb().query(
        'UPDATE period_records SET cycle_length = ?, period_length = ? WHERE id = ?',
        [cycleLength, periodLength, record.id],
      )
    }
  },

  /**
   * Predict next period based on average cycle length of last N records.
   */
  async predict(userId: number): Promise<{
    next_period_start: string
    next_period_end: string
    average_cycle_length: number
    average_period_length: number
    fertile_window_start: string
    fertile_window_end: string
  } | null> {
    const records = await this.findByUser(userId) // sorted DESC
    if (records.length < 1) return null

    // Get records with cycle_length (need at least one cycle)
    const withCycle = records.filter((r) => r.cycle_length !== null && r.cycle_length > 0)
    const withPeriod = records.filter((r) => r.period_length !== null && r.period_length > 0)

    // Defaults
    const avgCycleLength = withCycle.length > 0
      ? Math.round(withCycle.slice(0, 6).reduce((sum, r) => sum + r.cycle_length!, 0) / Math.min(withCycle.length, 6))
      : 28

    const avgPeriodLength = withPeriod.length > 0
      ? Math.round(withPeriod.slice(0, 6).reduce((sum, r) => sum + r.period_length!, 0) / Math.min(withPeriod.length, 6))
      : 5

    const lastRecord = records[0]
    const lastStart = new Date(lastRecord.start_date)

    // Next period start = last start + average cycle length
    const nextStart = new Date(lastStart)
    nextStart.setDate(nextStart.getDate() + avgCycleLength)

    // Next period end = next start + average period length - 1
    const nextEnd = new Date(nextStart)
    nextEnd.setDate(nextEnd.getDate() + avgPeriodLength - 1)

    // Fertile window: approximately 14 days before next period, lasting ~5 days
    const ovulationDay = new Date(nextStart)
    ovulationDay.setDate(ovulationDay.getDate() - 14)
    const fertileStart = new Date(ovulationDay)
    fertileStart.setDate(fertileStart.getDate() - 2)
    const fertileEnd = new Date(ovulationDay)
    fertileEnd.setDate(fertileEnd.getDate() + 2)

    const fmt = (d: Date) => d.toISOString().split('T')[0]

    return {
      next_period_start: fmt(nextStart),
      next_period_end: fmt(nextEnd),
      average_cycle_length: avgCycleLength,
      average_period_length: avgPeriodLength,
      fertile_window_start: fmt(fertileStart),
      fertile_window_end: fmt(fertileEnd),
    }
  },
}
