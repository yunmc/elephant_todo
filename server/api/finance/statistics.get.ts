export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  // Default to current month
  const now = new Date()
  const startDate = (query.start_date as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const endDateDefault = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const endDate = (query.end_date as string) || endDateDefault.toISOString().split('T')[0]

  const stats = await FinanceRecordModel.getStatistics(userId, startDate, endDate)

  return { success: true, data: stats }
})
