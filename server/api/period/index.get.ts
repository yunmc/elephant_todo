export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const records = await PeriodModel.findByUser(userId)
  return { success: true, data: records }
})
