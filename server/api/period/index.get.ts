export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)
  const personName = query.person_name ? String(query.person_name) : undefined
  const records = await PeriodModel.findByUser(userId, personName)
  return { success: true, data: records }
})
