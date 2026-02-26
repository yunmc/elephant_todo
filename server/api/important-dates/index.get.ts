export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const dates = await ImportantDateModel.findByUser(userId)

  // Compute days_until for each date
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const enriched = dates.map((d) => {
    const dateObj = new Date(d.date)
    let nextOccurrence: Date

    if (d.repeat_yearly) {
      // Find the next occurrence this year or next year
      nextOccurrence = new Date(now.getFullYear(), dateObj.getMonth(), dateObj.getDate())
      if (nextOccurrence < now) {
        nextOccurrence = new Date(now.getFullYear() + 1, dateObj.getMonth(), dateObj.getDate())
      }
    } else {
      nextOccurrence = dateObj
    }

    const diffMs = nextOccurrence.getTime() - now.getTime()
    const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    return { ...d, days_until: daysUntil }
  })

  // Sort by days_until (closest first)
  enriched.sort((a, b) => a.days_until - b.days_until)

  return { success: true, data: enriched }
})
