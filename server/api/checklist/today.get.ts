export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  // Default to today, allow date param for viewing other days
  let date: string
  if (query.date && typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
    date = query.date
  } else {
    const now = new Date()
    date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }

  const items = await ChecklistModel.getTodayItems(userId, date)
  return { success: true, data: items }
})
