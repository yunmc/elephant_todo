import type { AiQuickEntryResult } from '~~/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  await requirePremium(userId)
  rateLimitByUser(userId, 'ai', 20, 24 * 60 * 60 * 1000) // 每日 20 次/用户

  const { text } = await readBody<{ text: string }>(event)
  if (!text?.trim()) {
    throw createError({ statusCode: 400, message: '请输入记账内容' })
  }
  if (text.length > 500) {
    throw createError({ statusCode: 400, message: '输入内容不能超过500字' })
  }

  // 获取用户分类列表用于引导 AI
  const categories = await FinanceCategoryModel.findByUser(userId)
  const categoryNames = categories.map(c => `${c.name}(${c.type})`).join('、')

  const today = new Date().toISOString().split('T')[0]

  const prompt = loadPrompt('AI记账提示词.md')
    .replace('{categoryNames}', categoryNames)
    .replace('{today}', today)

  const result = await callLLM({
    systemPrompt: prompt,
    userMessage: text,
    temperature: 0.1,
    maxTokens: 256,
    preferModel: 'deepseek', // 短文本用 DeepSeek，成本低
  })

  const parsed = extractJSON<AiQuickEntryResult>(result.content)

  // 校验必要字段 + 兜底默认值
  if (typeof parsed.amount !== 'number' || parsed.amount <= 0) {
    throw createError({ statusCode: 422, message: 'AI 解析失败：无法识别金额' })
  }

  return {
    amount: parsed.amount,
    type: ['income', 'expense'].includes(parsed.type) ? parsed.type : 'expense',
    category_name: parsed.category_name || '',
    date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : today,
    note: parsed.note || '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
  }
})
