const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  await requirePremium(userId)

  const query = getQuery(event)
  const yearMonth = query.year_month as string

  if (!yearMonth || !YEAR_MONTH_REGEX.test(yearMonth)) {
    throw createError({ statusCode: 400, message: 'year_month 格式必须为 YYYY-MM' })
  }

  const budgets = await FinanceBudgetModel.findByMonth(userId, yearMonth)
  return { success: true, data: budgets }
})
