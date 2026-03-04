import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AiMonthlyReport } from '~~/types'

// 读取月度报告提示词模板
const promptPath = resolve(process.cwd(), 'prompts', '月度报告提示词.md')
let promptTemplate = ''
try {
  if (existsSync(promptPath)) {
    promptTemplate = readFileSync(promptPath, 'utf-8').trim()
  } else {
    console.error('[AiReport] 月度报告提示词文件不存在:', promptPath)
  }
} catch (err) {
  console.error('[AiReport] 读取月度报告提示词失败:', err)
}

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  await requirePremium(userId)

  const { year, month, regenerate } = await readBody<{
    year: number
    month: number
    regenerate?: boolean
  }>(event)

  // 参数校验
  if (!year || !month || month < 1 || month > 12) {
    throw createError({ statusCode: 400, message: '请提供有效的年月' })
  }

  // 不允许查看未来月份
  const now = new Date()
  if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) {
    throw createError({ statusCode: 400, message: '不能查看未来月份的报告' })
  }

  if (!promptTemplate) {
    throw createError({ statusCode: 500, message: 'AI 报告服务未就绪（提示词文件缺失）' })
  }

  // regenerate: 先删缓存
  if (regenerate) {
    await AiReportModel.deleteCache(userId, 'monthly', year, month)
  }

  // 查缓存
  const cached = await AiReportModel.getCached(userId, 'monthly', year, month)
  if (cached) {
    return {
      cached: true,
      report_type: 'monthly',
      report: cached.content as AiMonthlyReport,
      generated_at: cached.created_at,
    }
  }

  // 缓存未命中 → 限频
  rateLimitByUser(userId, 'ai', 20, 24 * 60 * 60 * 1000)

  // 聚合数据
  const data = await aggregateMonthlyData(userId, year, month)

  // 构造 prompt
  const categoryText = data.finance.categoryBreakdown.length > 0
    ? data.finance.categoryBreakdown.map((c: { name: string, amount: number, count: number }) => `${c.name} ¥${c.amount}（${c.count}笔）`).join('、')
    : '无消费记录'

  const prompt = promptTemplate
    .replace('{year}', String(year))
    .replace('{month}', String(month))
    .replace('{totalIncome}', String(data.finance.totalIncome))
    .replace('{totalExpense}', String(data.finance.totalExpense))
    .replace('{prevMonthExpense}', String(data.finance.prevMonthExpense))
    .replace('{categoryBreakdown}', categoryText)
    .replace('{todosCreated}', String(data.todos.created))
    .replace('{todosCompleted}', String(data.todos.completed))
    .replace('{todosOverdue}', String(data.todos.overdue))
    .replace('{prevCompletionRate}', String(data.todos.prevMonthCompletionRate))
    .replace('{ideasTotal}', String(data.ideas.total))
    .replace('{ideasLinked}', String(data.ideas.linkedCount))
    .replace('{thisMonthDates}', data.importantDates.thisMonth.join('、') || '无')
    .replace('{nextMonthDates}', data.importantDates.nextMonth.join('、') || '无')

  // 调用 LLM
  const result = await callLLM({
    systemPrompt: '',
    userMessage: prompt,
    temperature: 0.3,
    maxTokens: 1024,
    preferModel: 'gemini', // 月度报告用 Gemini 高质量
  })

  const report = extractJSON<AiMonthlyReport>(result.content)

  // 存缓存
  await AiReportModel.saveReport(userId, 'monthly', year, month, report)

  return {
    cached: false,
    report_type: 'monthly',
    report,
    generated_at: new Date().toISOString(),
  }
})
