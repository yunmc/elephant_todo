/**
 * AI Quick Entry API — Unit Tests
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

describe('AI Quick Entry — POST /api/ai/quick-entry', () => {
  let handler: Function

  beforeEach(async () => {
    vi.mocked(requireAuth).mockReturnValue(1)
    vi.mocked(requirePremium).mockResolvedValue(undefined as any)
    vi.mocked(rateLimitByUser).mockReturnValue(undefined as any)

    vi.stubGlobal('FinanceCategoryModel', {
      findByUser: vi.fn().mockResolvedValue([
        { id: 1, name: '餐饮', type: 'expense', icon: '🍔' },
        { id: 2, name: '饮品', type: 'expense', icon: '☕' },
        { id: 3, name: '工资', type: 'income', icon: '💰' },
      ]),
    })

    vi.stubGlobal('callLLM', vi.fn().mockResolvedValue({
      content: '{"amount": 38, "type": "expense", "category_name": "饮品", "date": "2026-03-04", "note": "星巴克拿铁", "confidence": 0.95}',
      model: 'test-model',
      provider: 'deepseek',
    }))

    vi.stubGlobal('extractJSON', vi.fn().mockReturnValue({
      amount: 38,
      type: 'expense',
      category_name: '饮品',
      date: '2026-03-04',
      note: '星巴克拿铁',
      confidence: 0.95,
    }))

    handler = (await import('../../server/api/ai/quick-entry.post')).default
  })

  it('should reject empty text', async () => {
    mockBody({ text: '' })
    await expectError(handler, 400, '请输入记账内容')
  })

  it('should reject text over 500 chars', async () => {
    mockBody({ text: 'a'.repeat(501) })
    await expectError(handler, 400, '不能超过500字')
  })

  it('should reject missing text', async () => {
    mockBody({})
    await expectError(handler, 400, '请输入记账内容')
  })

  it('should parse valid input and return structured data', async () => {
    mockBody({ text: '昨天星巴克拿铁38' })
    const result = await handler(event)

    expect(result.amount).toBe(38)
    expect(result.type).toBe('expense')
    expect(result.category_name).toBe('饮品')
    expect(result.date).toBe('2026-03-04')
    expect(result.note).toBe('星巴克拿铁')
    expect(result.confidence).toBe(0.95)

    expect(callLLM).toHaveBeenCalledWith(expect.objectContaining({
      preferModel: 'deepseek',
      temperature: 0.1,
      maxTokens: 256,
    }))
  })

  it('should call requirePremium', async () => {
    mockBody({ text: '买菜20' })
    await handler(event)
    expect(requirePremium).toHaveBeenCalledWith(1)
  })

  it('should call rateLimitByUser for ai bucket', async () => {
    mockBody({ text: '买菜20' })
    await handler(event)
    expect(rateLimitByUser).toHaveBeenCalledWith(1, 'ai', 20, 24 * 60 * 60 * 1000)
  })

  it('should default type to expense for invalid type', async () => {
    vi.mocked(extractJSON).mockReturnValue({
      amount: 10,
      type: 'invalid',
      category_name: '',
      date: '2026-01-01',
      note: '',
      confidence: 0.5,
    })

    mockBody({ text: '花了10块' })
    const result = await handler(event)
    expect(result.type).toBe('expense')
  })

  it('should default date to today for invalid date format', async () => {
    const today = new Date().toISOString().split('T')[0]
    vi.mocked(extractJSON).mockReturnValue({
      amount: 10,
      type: 'expense',
      category_name: '',
      date: 'invalid-date',
      note: '',
      confidence: 0,
    })

    mockBody({ text: '花了10块' })
    const result = await handler(event)
    expect(result.date).toBe(today)
  })

  it('should throw 422 when AI cannot identify amount', async () => {
    vi.mocked(extractJSON).mockReturnValue({
      amount: 0,
      type: 'expense',
      category_name: '',
      date: '2026-01-01',
      note: '',
      confidence: 0,
    })

    mockBody({ text: '去了星巴克' })
    await expectError(handler, 422, '无法识别金额')
  })

  it('should throw 422 when amount is negative', async () => {
    vi.mocked(extractJSON).mockReturnValue({
      amount: -10,
      type: 'expense',
      category_name: '',
      date: '2026-01-01',
      note: '',
      confidence: 0,
    })

    mockBody({ text: '花了-10' })
    await expectError(handler, 422, '无法识别金额')
  })

  it('should include user categories in LLM prompt', async () => {
    mockBody({ text: '买菜20' })
    await handler(event)

    const callArgs = vi.mocked(callLLM).mock.calls[0][0]
    expect(callArgs.systemPrompt).toContain('餐饮(expense)')
    expect(callArgs.systemPrompt).toContain('饮品(expense)')
    expect(callArgs.systemPrompt).toContain('工资(income)')
  })

  it('should block non-premium users', async () => {
    vi.mocked(requirePremium).mockRejectedValue(
      Object.assign(new Error('PREMIUM_REQUIRED'), { statusCode: 403 }),
    )

    mockBody({ text: '买菜20' })
    await expectError(handler, 403, 'PREMIUM_REQUIRED')
  })
})
