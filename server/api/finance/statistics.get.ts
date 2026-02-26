const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  // Default to current month
  const now = new Date()
  const startDate = (query.start_date as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const endDateDefault = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const endDate = (query.end_date as string) || endDateDefault.toISOString().split('T')[0]

  // Validate date format
  if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
    throw createError({ statusCode: 400, message: '日期格式必须为 YYYY-MM-DD' })
  }

  const stats = await FinanceRecordModel.getStatistics(userId, startDate, endDate)

  return { success: true, data: stats }
})
