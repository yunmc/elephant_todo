export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  const days = Math.min(Math.max(1, query.days ? Number(query.days) : 30), 365)

  const stats = await ChecklistModel.getStats(userId, days)
  return { success: true, data: stats }
})
