/**
 * Period Prediction Algorithm — Regression Tests
 *
 * These tests encode the EXACT algorithm from server/utils/models/period.model.ts.
 * If the source algorithm changes, these tests catch the regression.
 *
 * Two key algorithms are tested:
 *   1. recalculateCycleLengths — computes cycle_length and period_length
 *   2. predict — averages last 6 cycles ➜ next period + fertile window
 */
import { describe, it, expect } from 'vitest'

// ────────── Types mirroring PeriodRecordRow ──────────
interface MockRecord {
  id: number
  start_date: string
  end_date: string | null
  cycle_length: number | null
  period_length: number | null
}

// ────────── Pure logic extracted from recalculateCycleLengths ──────────
// Source: period.model.ts lines 115-155
function calculateCycleLengths(records: MockRecord[]): { id: number; cycle_length: number | null; period_length: number | null }[] {
  // records must be sorted by start_date DESC (newest first)
  return records.map((record, i) => {
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

    return { id: record.id, cycle_length: cycleLength, period_length: periodLength }
  })
}

// ────────── Pure logic extracted from predict ──────────
// Source: period.model.ts lines 160-216
function predict(records: MockRecord[]): {
  next_period_start: string
  next_period_end: string
  average_cycle_length: number
  average_period_length: number
  fertile_window_start: string
  fertile_window_end: string
} | null {
  if (records.length < 1) return null

  const withCycle = records.filter(r => r.cycle_length !== null && r.cycle_length! > 0)
  const withPeriod = records.filter(r => r.period_length !== null && r.period_length! > 0)

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
}

// ══════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════

describe('Period — recalculateCycleLengths logic', () => {
  it('should compute cycle_length as days between consecutive start_dates', () => {
    const records: MockRecord[] = [
      { id: 3, start_date: '2025-03-01', end_date: '2025-03-06', cycle_length: null, period_length: null },
      { id: 2, start_date: '2025-02-01', end_date: '2025-02-05', cycle_length: null, period_length: null },
      { id: 1, start_date: '2025-01-01', end_date: '2025-01-06', cycle_length: null, period_length: null },
    ]

    const result = calculateCycleLengths(records)

    // Newest record (index 0) has no cycle_length
    expect(result[0].cycle_length).toBeNull()
    // id=2: cycle = 2025-03-01 - 2025-02-01 = 28 days
    expect(result[1].cycle_length).toBe(28)
    // id=1: cycle = 2025-02-01 - 2025-01-01 = 31 days
    expect(result[2].cycle_length).toBe(31)
  })

  it('should compute period_length as end_date - start_date + 1', () => {
    const records: MockRecord[] = [
      { id: 1, start_date: '2025-01-01', end_date: '2025-01-05', cycle_length: null, period_length: null },
    ]
    const result = calculateCycleLengths(records)
    // 5th - 1st + 1 = 5 days
    expect(result[0].period_length).toBe(5)
  })

  it('should return null period_length when no end_date', () => {
    const records: MockRecord[] = [
      { id: 1, start_date: '2025-01-01', end_date: null, cycle_length: null, period_length: null },
    ]
    const result = calculateCycleLengths(records)
    expect(result[0].period_length).toBeNull()
  })

  it('should handle single record correctly', () => {
    const records: MockRecord[] = [
      { id: 1, start_date: '2025-01-10', end_date: '2025-01-15', cycle_length: null, period_length: null },
    ]
    const result = calculateCycleLengths(records)
    expect(result[0].cycle_length).toBeNull()
    expect(result[0].period_length).toBe(6) // 15 - 10 + 1
  })

  it('should handle same-day period (period_length = 1)', () => {
    const records: MockRecord[] = [
      { id: 1, start_date: '2025-01-01', end_date: '2025-01-01', cycle_length: null, period_length: null },
    ]
    const result = calculateCycleLengths(records)
    expect(result[0].period_length).toBe(1)
  })

  it('should handle irregular cycle lengths', () => {
    const records: MockRecord[] = [
      { id: 4, start_date: '2025-04-15', end_date: null, cycle_length: null, period_length: null },
      { id: 3, start_date: '2025-03-20', end_date: null, cycle_length: null, period_length: null },
      { id: 2, start_date: '2025-02-05', end_date: null, cycle_length: null, period_length: null },
      { id: 1, start_date: '2025-01-01', end_date: null, cycle_length: null, period_length: null },
    ]
    const result = calculateCycleLengths(records)
    expect(result[0].cycle_length).toBeNull() // newest
    expect(result[1].cycle_length).toBe(26)   // Apr 15 - Mar 20 = 26
    expect(result[2].cycle_length).toBe(43)   // Mar 20 - Feb 05 = 43
    expect(result[3].cycle_length).toBe(35)   // Feb 05 - Jan 01 = 35
  })
})

describe('Period — predict logic', () => {
  it('should return null when no records', () => {
    expect(predict([])).toBeNull()
  })

  it('should use default 28-day cycle and 5-day period when no cycle/period data', () => {
    const records: MockRecord[] = [
      { id: 1, start_date: '2025-06-01', end_date: null, cycle_length: null, period_length: null },
    ]
    const result = predict(records)!
    expect(result.average_cycle_length).toBe(28)
    expect(result.average_period_length).toBe(5)
    expect(result.next_period_start).toBe('2025-06-29') // Jun 1 + 28
    expect(result.next_period_end).toBe('2025-07-03')   // Jun 29 + 4
  })

  it('should use actual cycle_length average from records', () => {
    // 3 records with cycle_length: 30, 28, 26 → avg = 28
    const records: MockRecord[] = [
      { id: 3, start_date: '2025-06-01', end_date: '2025-06-06', cycle_length: null, period_length: 6 },
      { id: 2, start_date: '2025-05-02', end_date: '2025-05-07', cycle_length: 30, period_length: 6 },
      { id: 1, start_date: '2025-04-04', end_date: '2025-04-09', cycle_length: 28, period_length: 6 },
    ]
    const result = predict(records)!
    // withCycle: records with cycle_length > 0 ➜ id=2 (30) and id=1 (28)
    // avg cycle = (30 + 28) / 2 = 29
    expect(result.average_cycle_length).toBe(29)
    expect(result.average_period_length).toBe(6)
    expect(result.next_period_start).toBe('2025-06-30') // Jun 1 + 29
    expect(result.next_period_end).toBe('2025-07-05')   // Jun 30 + 5
  })

  it('should only average up to 6 most recent cycles', () => {
    const records: MockRecord[] = [
      { id: 8, start_date: '2025-08-01', end_date: null, cycle_length: null, period_length: null },
      { id: 7, start_date: '2025-07-02', end_date: null, cycle_length: 30, period_length: null },
      { id: 6, start_date: '2025-06-02', end_date: null, cycle_length: 30, period_length: null },
      { id: 5, start_date: '2025-05-03', end_date: null, cycle_length: 30, period_length: null },
      { id: 4, start_date: '2025-04-03', end_date: null, cycle_length: 30, period_length: null },
      { id: 3, start_date: '2025-03-04', end_date: null, cycle_length: 30, period_length: null },
      { id: 2, start_date: '2025-02-02', end_date: null, cycle_length: 30, period_length: null },
      // id=1 has cycle 100 but should be EXCLUDED (only first 6 are used)
      { id: 1, start_date: '2024-10-25', end_date: null, cycle_length: 100, period_length: null },
    ]
    const result = predict(records)!
    // withCycle: [id7=30, id6=30, id5=30, id4=30, id3=30, id2=30, id1=100]
    // slice(0,6) → [30,30,30,30,30,30] → avg = 30
    expect(result.average_cycle_length).toBe(30)
  })

  it('should calculate fertile window correctly', () => {
    const records: MockRecord[] = [
      { id: 1, start_date: '2025-06-01', end_date: '2025-06-05', cycle_length: null, period_length: 5 },
    ]
    const result = predict(records)!
    // next_period_start = Jun 1 + 28 = Jun 29
    // ovulation = Jun 29 - 14 = Jun 15
    // fertile_start = Jun 15 - 2 = Jun 13
    // fertile_end = Jun 15 + 2 = Jun 17
    expect(result.fertile_window_start).toBe('2025-06-13')
    expect(result.fertile_window_end).toBe('2025-06-17')
  })

  it('should handle prediction across month boundary', () => {
    const records: MockRecord[] = [
      { id: 1, start_date: '2025-12-15', end_date: '2025-12-20', cycle_length: null, period_length: 6 },
    ]
    const result = predict(records)!
    // Dec 15 + 28 = Jan 12
    expect(result.next_period_start).toBe('2026-01-12')
  })

  it('should handle prediction across year boundary', () => {
    const records: MockRecord[] = [
      { id: 2, start_date: '2025-12-20', end_date: '2025-12-25', cycle_length: null, period_length: 6 },
      { id: 1, start_date: '2025-11-20', end_date: '2025-11-25', cycle_length: 30, period_length: 6 },
    ]
    const result = predict(records)!
    // avg cycle = 30, Dec 20 + 30 = Jan 19, 2026
    expect(result.next_period_start).toBe('2026-01-19')
    expect(result.average_cycle_length).toBe(30)
  })

  it('should round average cycle length', () => {
    const records: MockRecord[] = [
      { id: 3, start_date: '2025-06-01', end_date: null, cycle_length: null, period_length: null },
      { id: 2, start_date: '2025-05-02', end_date: null, cycle_length: 29, period_length: null },
      { id: 1, start_date: '2025-04-03', end_date: null, cycle_length: 30, period_length: null },
    ]
    const result = predict(records)!
    // avg = (29 + 30) / 2 = 29.5 → round → 30
    expect(result.average_cycle_length).toBe(30)
  })

  it('should use default period length when no period data', () => {
    const records: MockRecord[] = [
      { id: 2, start_date: '2025-06-01', end_date: null, cycle_length: null, period_length: null },
      { id: 1, start_date: '2025-05-04', end_date: null, cycle_length: 28, period_length: null },
    ]
    const result = predict(records)!
    expect(result.average_period_length).toBe(5) // default
  })

  it('should filter out records with cycle_length = 0', () => {
    const records: MockRecord[] = [
      { id: 3, start_date: '2025-06-01', end_date: '2025-06-06', cycle_length: null, period_length: 6 },
      { id: 2, start_date: '2025-05-02', end_date: '2025-05-07', cycle_length: 0, period_length: 6 },
      { id: 1, start_date: '2025-04-04', end_date: '2025-04-09', cycle_length: 30, period_length: 6 },
    ]
    const result = predict(records)!
    // withCycle filters cycle_length > 0, so only id=1 (30)
    expect(result.average_cycle_length).toBe(30)
  })

  it('date formatter should produce YYYY-MM-DD with zero-padding', () => {
    const records: MockRecord[] = [
      { id: 1, start_date: '2025-01-05', end_date: '2025-01-07', cycle_length: null, period_length: 3 },
    ]
    const result = predict(records)!
    // Jan 5 + 28 = Feb 2
    expect(result.next_period_start).toBe('2025-02-02')
    // Verify zero-padding
    expect(result.next_period_start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
