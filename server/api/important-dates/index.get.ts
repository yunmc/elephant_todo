export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const dates = await ImportantDateModel.findByUser(userId)

  // Compute days_until for each date using UTC to avoid timezone issues
  const now = new Date()
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())

  const enriched = dates.map((d) => {
    const dateObj = new Date(d.date)
    const origMonth = dateObj.getUTCMonth()
    const origDay = dateObj.getUTCDate()
    let nextOccurrence: number

    if (d.repeat_yearly) {
      // Find the next occurrence this year or next year (UTC)
      const thisYear = new Date(now.getFullYear(), origMonth, origDay)
      const thisYearUTC = Date.UTC(now.getFullYear(), origMonth, origDay)
      if (thisYearUTC < todayUTC) {
        nextOccurrence = Date.UTC(now.getFullYear() + 1, origMonth, origDay)
      } else {
        nextOccurrence = thisYearUTC
      }
    } else {
      nextOccurrence = Date.UTC(dateObj.getUTCFullYear(), origMonth, origDay)
    }

    const diffMs = nextOccurrence - todayUTC
    const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24))

    return { ...d, days_until: daysUntil }
  })

  // Sort by days_until (closest first)
  enriched.sort((a, b) => a.days_until - b.days_until)

  return { success: true, data: enriched }
})
