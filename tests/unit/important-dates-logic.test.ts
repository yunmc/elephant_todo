/**
 * Important Dates — days_until Computation — Regression Tests
 *
 * Tests the exact logic from server/api/important-dates/index.get.ts
 * that computes days_until for each important date.
 *
 * Key behaviors:
 *   - repeat_yearly: wraps to next year if date already passed
 *   - non-repeat: always uses original date (can be negative)
 *   - UTC-based calculation to avoid timezone issues
 *   - Results sorted by days_until ascending
 */
import { describe, it, expect } from 'vitest'

// ────────── Types ──────────
interface MockDate {
  id: number
  date: string     // YYYY-MM-DD stored in DB
  repeat_yearly: boolean
  title: string
}

interface EnrichedDate extends MockDate {
  days_until: number
}

// ────────── Pure logic extracted from index.get.ts ──────────
function computeDaysUntil(dates: MockDate[], today: Date): EnrichedDate[] {
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())

  const enriched = dates.map((d) => {
    const dateObj = new Date(d.date)
    const origMonth = dateObj.getUTCMonth()
    const origDay = dateObj.getUTCDate()
    let nextOccurrence: number

    if (d.repeat_yearly) {
      const thisYearUTC = Date.UTC(today.getFullYear(), origMonth, origDay)
      if (thisYearUTC < todayUTC) {
        nextOccurrence = Date.UTC(today.getFullYear() + 1, origMonth, origDay)
      } else {
        nextOccurrence = thisYearUTC
      }
    } else {
      nextOccurrence = Date.UTC(dateObj.getUTCFullYear(), origMonth, origDay)
    }

    const diffMs = nextOccurrence - todayUTC
    const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24))

    return { ...d, days_until: daysUntil }
  })

  enriched.sort((a, b) => a.days_until - b.days_until)
  return enriched
}

// ══════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════

describe('Important Dates — days_until calculation', () => {
  // Fixed "today" for deterministic tests
  const today = new Date('2025-06-15T12:00:00Z')

  it('should compute 0 days for today (non-repeating)', () => {
    const dates: MockDate[] = [
      { id: 1, date: '2025-06-15', repeat_yearly: false, title: 'Today' },
    ]
    const result = computeDaysUntil(dates, today)
    expect(result[0].days_until).toBe(0)
  })

  it('should compute 0 days for today (repeat_yearly)', () => {
    const dates: MockDate[] = [
      { id: 1, date: '2000-06-15', repeat_yearly: true, title: 'Birthday today' },
    ]
    const result = computeDaysUntil(dates, today)
    expect(result[0].days_until).toBe(0)
  })

  it('should compute positive days for future non-repeating date', () => {
    const dates: MockDate[] = [
      { id: 1, date: '2025-07-01', repeat_yearly: false, title: 'Event' },
    ]
    const result = computeDaysUntil(dates, today)
    expect(result[0].days_until).toBe(16) // Jul 1 - Jun 15
  })

  it('should compute negative days for past non-repeating date', () => {
    const dates: MockDate[] = [
      { id: 1, date: '2025-06-10', repeat_yearly: false, title: 'Past event' },
    ]
    const result = computeDaysUntil(dates, today)
    expect(result[0].days_until).toBe(-5) // Jun 10 - Jun 15
  })

  it('should wrap to next year for repeat_yearly date that already passed', () => {
    const dates: MockDate[] = [
      { id: 1, date: '2000-01-01', repeat_yearly: true, title: 'New Year' },
    ]
    // Today is June 15, 2025 → Jan 1 already passed → next is Jan 1, 2026
    const result = computeDaysUntil(dates, today)
    // Jun 15 → Jan 1 next year = 200 days
    const expected = Math.round(
      (Date.UTC(2026, 0, 1) - Date.UTC(2025, 5, 15)) / (1000 * 60 * 60 * 24),
    )
    expect(result[0].days_until).toBe(expected)
  })

  it('should use this year for repeat_yearly date coming up', () => {
    const dates: MockDate[] = [
      { id: 1, date: '1990-12-25', repeat_yearly: true, title: 'Christmas' },
    ]
    // Today is Jun 15, 2025 → Dec 25 is still ahead this year
    const result = computeDaysUntil(dates, today)
    const expected = Math.round(
      (Date.UTC(2025, 11, 25) - Date.UTC(2025, 5, 15)) / (1000 * 60 * 60 * 24),
    )
    expect(result[0].days_until).toBe(expected)
  })

  it('should sort by days_until ascending', () => {
    const dates: MockDate[] = [
      { id: 1, date: '2025-12-25', repeat_yearly: false, title: 'Christmas' },
      { id: 2, date: '2025-06-20', repeat_yearly: false, title: 'Soon' },
      { id: 3, date: '2025-06-16', repeat_yearly: false, title: 'Tomorrow' },
    ]
    const result = computeDaysUntil(dates, today)
    expect(result[0].title).toBe('Tomorrow')
    expect(result[1].title).toBe('Soon')
    expect(result[2].title).toBe('Christmas')
    expect(result[0].days_until).toBe(1)
    expect(result[1].days_until).toBe(5)
  })

  it('should handle Feb 29 birthday in non-leap year', () => {
    // Feb 29 birthdate, checked on Jun 15, 2025
    // 2026 is NOT a leap year → Date.UTC(2026, 1, 29) actually becomes Mar 1!
    const dates: MockDate[] = [
      { id: 1, date: '2000-02-29', repeat_yearly: true, title: 'Leap birthday' },
    ]
    const result = computeDaysUntil(dates, today)
    // This tests how JS handles Feb 29 in non-leap years (rolls to Mar 1)
    // Feb 29 already passed in 2025 → tries 2026-02-29 → becomes 2026-03-01
    expect(result[0].days_until).toBeGreaterThan(0)
  })

  it('should handle far future non-repeating date', () => {
    const dates: MockDate[] = [
      { id: 1, date: '2030-01-01', repeat_yearly: false, title: 'Far future' },
    ]
    const result = computeDaysUntil(dates, today)
    expect(result[0].days_until).toBeGreaterThan(1000)
  })

  it('should handle same date repeat_yearly correctly at year boundary', () => {
    const todayDec31 = new Date('2025-12-31T00:00:00Z')
    const dates: MockDate[] = [
      { id: 1, date: '2000-01-01', repeat_yearly: true, title: 'New Year' },
    ]
    const result = computeDaysUntil(dates, todayDec31)
    expect(result[0].days_until).toBe(1) // Tomorrow
  })

  it('should handle multiple dates with mixed repeat settings', () => {
    const dates: MockDate[] = [
      { id: 1, date: '2025-06-16', repeat_yearly: false, title: 'One-time' },
      { id: 2, date: '2000-06-20', repeat_yearly: true, title: 'Annual' },
      { id: 3, date: '2020-06-10', repeat_yearly: false, title: 'Past one-time' },
    ]
    const result = computeDaysUntil(dates, today)
    // Sort is ascending: past dates (negative) come first
    expect(result[0].title).toBe('Past one-time')
    expect(result[0].days_until).toBeLessThan(0)
    // Annual (Jun 20, +5) is after One-time (Jun 16, +1)
    expect(result[1].title).toBe('One-time')
    expect(result[2].title).toBe('Annual')
  })
})
