
export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const [totalUsers, premiumUsers, todayNew, todayActive, revenue, moduleUsage] = await Promise.all([
    AdminStatsModel.totalUsers(),
    AdminStatsModel.premiumUsers(),
    AdminStatsModel.todayRegistrations(),
    AdminStatsModel.todayActiveUsers(),
    AdminStatsModel.totalRevenue(),
    AdminStatsModel.moduleUsage(),
  ])

  return {
    success: true,
    data: {
      totalUsers,
      premiumUsers,
      todayNew,
      todayActive,
      conversionRate: totalUsers > 0 ? +(premiumUsers / totalUsers * 100).toFixed(1) : 0,
      revenue,
      moduleUsage,
    },
  }
})
