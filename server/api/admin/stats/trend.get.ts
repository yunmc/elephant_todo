
export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const query = getQuery(event)
  const days = Number(query.days) || 30

  const trend = await AdminStatsModel.registrationTrend(days)

  return { success: true, data: trend }
})
