import type { AiYearlyReport } from '~~/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  await requirePremium(userId)

  const { year, regenerate } = await readBody<{
    year: number
    regenerate?: boolean
  }>(event)

  // 参数校验
  if (!year || year < 2020 || year > new Date().getFullYear()) {
    throw createError({ statusCode: 400, message: '请提供有效的年份' })
  }



  // regenerate: 先删缓存
  if (regenerate) {
    await AiReportModel.deleteCache(userId, 'yearly', year)
  }

  // 查缓存
  const cached = await AiReportModel.getCached(userId, 'yearly', year)
  if (cached) {
    return {
      cached: true,
      report_type: 'yearly',
      report: cached.content as AiYearlyReport,
      generated_at: cached.created_at,
    }
  }

  // 缓存未命中 → 限频
  rateLimitByUser(userId, 'ai', 20, 24 * 60 * 60 * 1000)

  // 聚合数据
  const data = await aggregateYearlyData(userId, year)

  // 找最节省/最大支出月份
  let minMonth = 1, minAmount = Infinity
  let maxMonth = 1, maxAmount = 0
  for (const m of data.finance.monthlyExpenses) {
    if (m.amount < minAmount) { minMonth = m.month; minAmount = m.amount }
    if (m.amount > maxAmount) { maxMonth = m.month; maxAmount = m.amount }
  }
  if (minAmount === Infinity) minAmount = 0

  const avgMonthlyExpense = data.finance.monthlyExpenses.length > 0
    ? Math.round(data.finance.totalExpense / data.finance.monthlyExpenses.length)
    : 0

  const topCategoriesText = data.finance.topCategories.length > 0
    ? data.finance.topCategories.slice(0, 3).map((c: { name: string, amount: number, percentage: number }) => `${c.name} ¥${c.amount}（${c.percentage}%）`).join('、')
    : '无消费记录'

  // 构造 prompt
  const prompt = loadPrompt('年度报告提示词.md')
    .replace('{year}', String(year))
    .replace('{totalIncome}', String(data.finance.totalIncome))
    .replace('{totalExpense}', String(data.finance.totalExpense))
    .replace('{avgMonthlyExpense}', String(avgMonthlyExpense))
    .replace('{minMonth}', String(minMonth))
    .replace('{minAmount}', String(minAmount))
    .replace('{maxMonth}', String(maxMonth))
    .replace('{maxAmount}', String(maxAmount))
    .replace('{topCategories}', topCategoriesText)
    .replace('{todosCreated}', String(data.todos.totalCreated))
    .replace('{todosCompleted}', String(data.todos.totalCompleted))
    .replace('{completionRate}', String(data.todos.completionRate))
    .replace('{busiestMonth}', String(data.todos.busiestMonth))
    .replace('{mostEfficientMonth}', String(data.todos.mostEfficientMonth.month))
    .replace('{mostEfficientRate}', String(data.todos.mostEfficientMonth.rate))
    .replace('{ideasTotal}', String(data.ideas.total))
    .replace('{ideasBusiestMonth}', String(data.ideas.busiestMonth.month))
    .replace('{ideasBusiestCount}', String(data.ideas.busiestMonth.count))

  // 调用 LLM
  const result = await callLLM({
    systemPrompt: '',
    userMessage: prompt,
    temperature: 0.3,
    maxTokens: 1024,
    preferModel: 'gemini', // 年度报告用 Gemini 高质量
  })

  const report = extractJSON<AiYearlyReport>(result.content)

  // 存缓存
  await AiReportModel.saveReport(userId, 'yearly', year, 0, report)

  return {
    cached: false,
    report_type: 'yearly',
    report,
    generated_at: new Date().toISOString(),
  }
})
