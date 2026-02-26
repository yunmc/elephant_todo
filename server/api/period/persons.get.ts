export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const names = await PeriodModel.getPersonNames(userId)
  return { success: true, data: names }
})
