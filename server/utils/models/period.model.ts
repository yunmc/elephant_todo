import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type {
  PeriodRecordRow,
  CreatePeriodRecordDTO,
  UpdatePeriodRecordDTO,
} from '~~/server/types'

export const PeriodModel = {
  async findByUser(userId: number, personName?: string): Promise<PeriodRecordRow[]> {
    if (personName) {
      const [rows] = await getDb().query<PeriodRecordRow[]>(
        'SELECT * FROM period_records WHERE user_id = ? AND person_name = ? ORDER BY start_date DESC',
        [userId, personName],
      )
      return rows
    }
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

  /** Get distinct person names for a user */
  async getPersonNames(userId: number): Promise<string[]> {
    const [rows] = await getDb().query<RowDataPacket[]>(
      'SELECT DISTINCT person_name FROM period_records WHERE user_id = ? ORDER BY person_name',
      [userId],
    )
    return rows.map((r) => r.person_name as string)
  },

  async create(userId: number, data: CreatePeriodRecordDTO): Promise<number> {
    const personName = data.person_name || '我'
    const [result] = await getDb().query<ResultSetHeader>(
      'INSERT INTO period_records (user_id, person_name, start_date, end_date, flow_level, symptoms, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        personName,
        data.start_date,
        data.end_date || null,
        data.flow_level || 'moderate',
        data.symptoms ? JSON.stringify(data.symptoms) : null,
        data.note || null,
      ],
    )

    // Auto-calculate cycle_length and period_length
    await this.recalculateCycleLengths(userId, personName)

    return result.insertId
  },

  async update(id: number, userId: number, data: UpdatePeriodRecordDTO): Promise<boolean> {
    const fields: string[] = []
    const values: any[] = []
    if (data.person_name !== undefined) { fields.push('person_name = ?'); values.push(data.person_name) }
    if (data.start_date !== undefined) { fields.push('start_date = ?'); values.push(data.start_date) }
    if (data.end_date !== undefined) { fields.push('end_date = ?'); values.push(data.end_date) }
    if (data.flow_level !== undefined) { fields.push('flow_level = ?'); values.push(data.flow_level) }
    if (data.symptoms !== undefined) { fields.push('symptoms = ?'); values.push(JSON.stringify(data.symptoms)) }
    if (data.note !== undefined) { fields.push('note = ?'); values.push(data.note) }
    if (fields.length === 0) return false

    const [result] = await getDb().query<ResultSetHeader>(
      `UPDATE period_records SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      [...values, id, userId],
    )

    if (result.affectedRows > 0) {
      // Recalculate for the person this record belongs to
      const updated = await this.findById(id, userId)
      if (updated) {
        await this.recalculateCycleLengths(userId, updated.person_name)
      }
    }

    return result.affectedRows > 0
  },

  async delete(id: number, userId: number): Promise<boolean> {
    // Get record first to know the person_name for recalculation
    const record = await this.findById(id, userId)
    if (!record) return false

    const [result] = await getDb().query<ResultSetHeader>(
      'DELETE FROM period_records WHERE id = ? AND user_id = ?',
      [id, userId],
    )
    if (result.affectedRows > 0) {
      await this.recalculateCycleLengths(userId, record.person_name)
    }
    return result.affectedRows > 0
  },

  /**
   * Recalculate cycle_length and period_length for all records of a user+person.
   * Uses batch UPDATE via CASE to avoid N+1 queries.
   */
  async recalculateCycleLengths(userId: number, personName: string): Promise<void> {
    const [records] = await getDb().query<PeriodRecordRow[]>(
      'SELECT * FROM period_records WHERE user_id = ? AND person_name = ? ORDER BY start_date DESC',
      [userId, personName],
    )

    if (records.length === 0) return

    // Build batch update
    const ids: number[] = []
    const cycleCases: string[] = []
    const periodCases: string[] = []
    const params: any[] = []

    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      ids.push(record.id)

      let cycleLength: number | null = null
      if (i > 0) {
        const newerRecord = records[i - 1]
        const diffMs = new Date(newerRecord.start_date).getTime() - new Date(record.start_date).getTime()
        cycleLength = Math.round(diffMs / (1000 * 60 * 60 * 24))
      }

      let periodLength: number | null = null
      if (record.end_date) {
        const diffMs = new Date(record.end_date).getTime() - new Date(record.start_date).getTime()
        periodLength = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
      }

      cycleCases.push('WHEN id = ? THEN ?')
      params.push(record.id, cycleLength)
      periodCases.push('WHEN id = ? THEN ?')
      params.push(record.id, periodLength)
    }

    const idPlaceholders = ids.map(() => '?').join(',')
    params.push(...ids)

    await getDb().query(
      `UPDATE period_records SET
        cycle_length = CASE ${cycleCases.join(' ')} END,
        period_length = CASE ${periodCases.join(' ')} END
       WHERE id IN (${idPlaceholders})`,
      params,
    )
  },

  /**
   * Predict next period based on average cycle length of last N records.
   */
  async predict(userId: number, personName?: string): Promise<{
    next_period_start: string
    next_period_end: string
    average_cycle_length: number
    average_period_length: number
    fertile_window_start: string
    fertile_window_end: string
  } | null> {
    const records = await this.findByUser(userId, personName || '我')
    if (records.length < 1) return null

    const withCycle = records.filter((r) => r.cycle_length !== null && r.cycle_length > 0)
    const withPeriod = records.filter((r) => r.period_length !== null && r.period_length > 0)

    const avgCycleLength = withCycle.length > 0
      ? Math.round(withCycle.slice(0, 6).reduce((sum, r) => sum + r.cycle_length!, 0) / Math.min(withCycle.length, 6))
      : 28

    const avgPeriodLength = withPeriod.length > 0
      ? Math.round(withPeriod.slice(0, 6).reduce((sum, r) => sum + r.period_length!, 0) / Math.min(withPeriod.length, 6))
      : 5

    const lastRecord = records[0]
    const lastStart = new Date(lastRecord.start_date)

    const nextStart = new Date(lastStart)
    nextStart.setDate(nextStart.getDate() + avgCycleLength)

    const nextEnd = new Date(nextStart)
    nextEnd.setDate(nextEnd.getDate() + avgPeriodLength - 1)

    const ovulationDay = new Date(nextStart)
    ovulationDay.setDate(ovulationDay.getDate() - 14)
    const fertileStart = new Date(ovulationDay)
    fertileStart.setDate(fertileStart.getDate() - 2)
    const fertileEnd = new Date(ovulationDay)
    fertileEnd.setDate(fertileEnd.getDate() + 2)

    // Use local date formatting to avoid timezone shift
    const fmt = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

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
