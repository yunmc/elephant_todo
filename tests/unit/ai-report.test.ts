/**
 * AI Report API — Unit Tests
 * Tests monthly and yearly report endpoints + caching + rate limiting.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const event = {} as any

function mockBody(body: any) {
  vi.mocked(readBody).mockResolvedValue(body)
}

async function expectError(handler: Function, statusCode: number, messageFragment?: string) {
  try {
    await handler(event)
    expect.unreachable(`expected ${statusCode} error`)
  } catch (e: any) {
    expect(e.statusCode).toBe(statusCode)
    if (messageFragment) expect(e.message).toContain(messageFragment)
  }
}

// ══════════════════════════════════════════════════════════════
// Monthly Report
// ══════════════════════════════════════════════════════════════

describe('AI Monthly Report — POST /api/ai/report/monthly', () => {
  let handler: Function

  const mockMonthlyData = {
    finance: {
      totalIncome: 8000,
      totalExpense: 3280,
      prevMonthExpense: 3728,
      categoryBreakdown: [
        { name: '餐饮', amount: 1246, count: 32 },
        { name: '交通', amount: 580, count: 22 },
      ],
    },
    todos: {
      created: 41,
      completed: 32,
      overdue: 5,
      prevMonthCompletionRate: 72,
    },
    ideas: {
      total: 18,
      linkedCount: 12,
    },
    importantDates: {
      thisMonth: ['纪念日'],
      nextMonth: ['妈妈生日'],
    },
  }

  const mockReport = {
    finance_insight: '总支出 ¥3,280',
    finance_suggestion: '建议下月预算 ¥3,000',
    todo_insight: '完成 32 个待办',
    idea_insight: '记录 18 条',
    date_reminder: '下月提醒：妈妈生日',
    summary: '保持进步！',
    keywords: ['项目', '健身'],
  }

  beforeEach(async () => {
    vi.mocked(requireAuth).mockReturnValue(1)
    vi.mocked(requirePremium).mockResolvedValue(undefined as any)
    vi.mocked(rateLimitByUser).mockReturnValue(undefined as any)

    vi.stubGlobal('AiReportModel', {
      getCached: vi.fn().mockResolvedValue(null),
      saveReport: vi.fn().mockResolvedValue(1),
      deleteCache: vi.fn().mockResolvedValue(undefined),
    })

    vi.stubGlobal('aggregateMonthlyData', vi.fn().mockResolvedValue(mockMonthlyData))

    vi.stubGlobal('callLLM', vi.fn().mockResolvedValue({
      content: JSON.stringify(mockReport),
      model: 'gemini-pro',
      provider: 'gemini',
    }))

    vi.stubGlobal('extractJSON', vi.fn().mockReturnValue(mockReport))

    handler = (await import('../../server/api/ai/report/monthly.post')).default
  })

  it('should reject missing year/month', async () => {
    mockBody({})
    await expectError(handler, 400, '有效的年月')
  })

  it('should reject invalid month', async () => {
    mockBody({ year: 2026, month: 13 })
    await expectError(handler, 400, '有效的年月')
  })

  it('should reject month 0', async () => {
    mockBody({ year: 2026, month: 0 })
    await expectError(handler, 400, '有效的年月')
  })

  it('should return cached report if available', async () => {
    vi.mocked(AiReportModel.getCached).mockResolvedValue({
      id: 1,
      user_id: 1,
      report_type: 'monthly',
      year: 2025,
      month: 3,
      content: mockReport,
      created_at: '2025-04-01T00:00:00Z',
    } as any)

    mockBody({ year: 2025, month: 3 })
    const result = await handler(event)

    expect(result.cached).toBe(true)
    expect(result.report).toEqual(mockReport)
    expect(result.report_type).toBe('monthly')
    // Should NOT call rateLimitByUser when cached
    expect(rateLimitByUser).not.toHaveBeenCalled()
    // Should NOT call callLLM when cached
    expect(callLLM).not.toHaveBeenCalled()
  })

  it('should generate new report when not cached', async () => {
    mockBody({ year: 2025, month: 3 })
    const result = await handler(event)

    expect(result.cached).toBe(false)
    expect(result.report).toEqual(mockReport)
    expect(aggregateMonthlyData).toHaveBeenCalledWith(1, 2025, 3)
    expect(callLLM).toHaveBeenCalled()
    expect(AiReportModel.saveReport).toHaveBeenCalledWith(1, 'monthly', 2025, 3, mockReport)
  })

  it('should rate limit when cache miss', async () => {
    mockBody({ year: 2025, month: 3 })
    await handler(event)
    expect(rateLimitByUser).toHaveBeenCalledWith(1, 'ai', 20, 24 * 60 * 60 * 1000)
  })

  it('should delete cache and regenerate when regenerate=true', async () => {
    mockBody({ year: 2025, month: 3, regenerate: true })
    await handler(event)

    expect(AiReportModel.deleteCache).toHaveBeenCalledWith(1, 'monthly', 2025, 3)
    expect(aggregateMonthlyData).toHaveBeenCalled()
    expect(callLLM).toHaveBeenCalled()
  })

  it('should use gemini as preferred model', async () => {
    mockBody({ year: 2025, month: 3 })
    await handler(event)

    expect(callLLM).toHaveBeenCalledWith(expect.objectContaining({
      preferModel: 'gemini',
      maxTokens: 1024,
    }))
  })

  it('should block non-premium users', async () => {
    vi.mocked(requirePremium).mockRejectedValue(
      Object.assign(new Error('PREMIUM_REQUIRED'), { statusCode: 403 }),
    )
    mockBody({ year: 2025, month: 3 })
    await expectError(handler, 403)
  })
})

// ══════════════════════════════════════════════════════════════
// Yearly Report
// ══════════════════════════════════════════════════════════════

describe('AI Yearly Report — POST /api/ai/report/yearly', () => {
  let handler: Function

  const mockYearlyData = {
    finance: {
      totalIncome: 96000,
      totalExpense: 45000,
      monthlyExpenses: [
        { month: 1, amount: 3500 },
        { month: 2, amount: 3200 },
        { month: 3, amount: 4100 },
      ],
      topCategories: [
        { name: '餐饮', amount: 15000, percentage: 33 },
        { name: '交通', amount: 6000, percentage: 13 },
      ],
    },
    todos: {
      totalCreated: 480,
      totalCompleted: 380,
      completionRate: 79,
      busiestMonth: 3,
      mostEfficientMonth: { month: 6, rate: 92 },
    },
    ideas: {
      total: 200,
      busiestMonth: { month: 5, count: 30 },
    },
  }

  const mockYearlyReport = {
    finance_summary: '年度消费总结',
    finance_monthly_trend: '月度趋势',
    todo_summary: '效率总结',
    idea_summary: '随手记总结',
    highlights: '年度亮点',
    summary: '年度总结',
    keywords: ['工作', '健身'],
  }

  beforeEach(async () => {
    vi.mocked(requireAuth).mockReturnValue(1)
    vi.mocked(requirePremium).mockResolvedValue(undefined as any)
    vi.mocked(rateLimitByUser).mockReset()
    vi.mocked(rateLimitByUser).mockReturnValue(undefined as any)

    vi.stubGlobal('AiReportModel', {
      getCached: vi.fn().mockResolvedValue(null),
      saveReport: vi.fn().mockResolvedValue(1),
      deleteCache: vi.fn().mockResolvedValue(undefined),
    })

    vi.stubGlobal('aggregateYearlyData', vi.fn().mockResolvedValue(mockYearlyData))

    vi.stubGlobal('callLLM', vi.fn().mockResolvedValue({
      content: JSON.stringify(mockYearlyReport),
      model: 'gemini-pro',
      provider: 'gemini',
    }))

    vi.stubGlobal('extractJSON', vi.fn().mockReturnValue(mockYearlyReport))

    handler = (await import('../../server/api/ai/report/yearly.post')).default
  })

  it('should reject missing year', async () => {
    mockBody({})
    await expectError(handler, 400, '有效的年份')
  })

  it('should reject year before 2020', async () => {
    mockBody({ year: 2019 })
    await expectError(handler, 400, '有效的年份')
  })

  it('should return cached yearly report', async () => {
    vi.mocked(AiReportModel.getCached).mockResolvedValue({
      id: 1,
      user_id: 1,
      report_type: 'yearly',
      year: 2025,
      month: 0,
      content: mockYearlyReport,
      created_at: '2026-01-01T00:00:00Z',
    } as any)

    mockBody({ year: 2025 })
    const result = await handler(event)

    expect(result.cached).toBe(true)
    expect(result.report).toEqual(mockYearlyReport)
    expect(result.report_type).toBe('yearly')
    expect(rateLimitByUser).not.toHaveBeenCalled()
  })

  it('should generate yearly report when not cached', async () => {
    mockBody({ year: 2025 })
    const result = await handler(event)

    expect(result.cached).toBe(false)
    expect(result.report).toEqual(mockYearlyReport)
    expect(aggregateYearlyData).toHaveBeenCalledWith(1, 2025)
    expect(AiReportModel.saveReport).toHaveBeenCalledWith(1, 'yearly', 2025, 0, mockYearlyReport)
  })

  it('should delete cache on regenerate', async () => {
    mockBody({ year: 2025, regenerate: true })
    await handler(event)

    expect(AiReportModel.deleteCache).toHaveBeenCalledWith(1, 'yearly', 2025)
  })

  it('should use gemini and 1024 tokens', async () => {
    mockBody({ year: 2025 })
    await handler(event)

    expect(callLLM).toHaveBeenCalledWith(expect.objectContaining({
      preferModel: 'gemini',
      maxTokens: 1024,
    }))
  })
})

// ══════════════════════════════════════════════════════════════
// Smart Suggest (refactored)
// ══════════════════════════════════════════════════════════════

describe('Smart Suggest — refactored with callLLM', () => {
  let handler: Function

  beforeEach(async () => {
    vi.mocked(requireAuth).mockReturnValue(1)
    vi.mocked(requirePremium).mockResolvedValue(undefined as any)
    vi.mocked(rateLimit).mockReturnValue(undefined as any)

    vi.stubGlobal('getPool', () => ({
      query: vi.fn().mockResolvedValue([[
        { id: 1, title: '买菜', description: '' },
        { id: 2, title: '做饭', description: '准备晚餐' },
      ]]),
    }))

    vi.stubGlobal('callLLM', vi.fn().mockResolvedValue({
      content: '{"similar_todos": [{"id": 1, "similarity": 0.8, "reason": "相似"}]}',
      model: 'gemini-pro',
      provider: 'gemini',
    }))

    vi.stubGlobal('extractJSON', vi.fn().mockReturnValue({
      similar_todos: [{ id: 1, similarity: 0.8, reason: '相似' }],
    }))

    handler = (await import('../../server/api/match/smart-suggest.post')).default
  })

  it('should call smart-suggest without premium check', async () => {
    vi.mocked(requirePremium).mockClear()
    mockBody({ text: '买菜' })
    await handler(event)
    expect(requirePremium).not.toHaveBeenCalled()
  })

  it('should reject empty text', async () => {
    mockBody({ text: '' })
    await expectError(handler, 400, '请提供输入文本')
  })

  it('should reject text over 500 chars', async () => {
    mockBody({ text: 'a'.repeat(501) })
    await expectError(handler, 400, '不能超过 500 字')
  })

  it('should call callLLM instead of inline fetch', async () => {
    mockBody({ text: '买菜' })
    await handler(event)
    expect(callLLM).toHaveBeenCalled()
  })

  it('should return enriched similar todos', async () => {
    mockBody({ text: '买菜' })
    const result = await handler(event)

    expect(result.success).toBe(true)
    expect(result.data.similar_todos).toHaveLength(1)
    expect(result.data.similar_todos[0]).toEqual({
      id: 1,
      title: '买菜',
      similarity: 0.8,
      reason: '相似',
    })
  })

  it('should filter todos below similarity threshold', async () => {
    vi.mocked(extractJSON).mockReturnValue({
      similar_todos: [{ id: 1, similarity: 0.3, reason: '不太像' }],
    })

    mockBody({ text: '买菜' })
    const result = await handler(event)
    expect(result.data.similar_todos).toHaveLength(0)
  })

  it('should return empty when JSON parse fails', async () => {
    vi.mocked(extractJSON).mockImplementation(() => {
      throw new Error('parse error')
    })

    mockBody({ text: '买菜' })
    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.data.similar_todos).toHaveLength(0)
  })
})
