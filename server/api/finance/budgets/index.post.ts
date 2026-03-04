const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  await requirePremium(userId)

  const { category_id, year_month, amount } = await readBody(event)

  if (!year_month || !YEAR_MONTH_REGEX.test(year_month)) {
    throw createError({ statusCode: 400, message: 'year_month 格式必须为 YYYY-MM' })
  }
  if (!amount || Number(amount) <= 0) {
    throw createError({ statusCode: 400, message: '预算金额必须大于 0' })
  }

  await FinanceBudgetModel.upsert(userId, {
    category_id: category_id ?? null,
    year_month,
    amount: Number(amount),
  })

  // 返回最新的预算列表
  const budgets = await FinanceBudgetModel.findByMonth(userId, year_month)
  return { success: true, data: budgets }
})
