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

  const result = await callLLM({
    systemPrompt: `你是一个记账助手。请从用户输入中提取以下信息，返回 JSON：
- amount: 金额（数字）
- type: "expense" 或 "income"
- category_name: 消费分类（从以下分类中选择最匹配的：${categoryNames}）
- date: 日期（ISO 格式，"昨天""前天"等请转换为具体日期，今天是 ${today}）
- note: 简短备注
- confidence: 你对解析结果的置信度（0-1）

只返回 JSON，不要解释。如果信息不完整，用合理默认值填充（日期默认今天，类型默认支出）。`,
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
