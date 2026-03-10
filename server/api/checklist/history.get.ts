export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  const startDate = query.start_date as string
  const endDate = query.end_date as string

  if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw createError({ statusCode: 400, message: 'start_date 和 end_date 为必填项，格式 YYYY-MM-DD' })
  }
  if (startDate > endDate) {
    throw createError({ statusCode: 400, message: 'start_date 不能晚于 end_date' })
  }

  const records = await ChecklistModel.getHistory(userId, startDate, endDate)

  // Get all active items for date range display
  const items = await ChecklistModel.getItems(userId)
  const activeItems = items.filter((i: any) => i.is_active)

  // Group by date
  const dateMap = new Map<string, Map<number, boolean>>()
  for (const r of records) {
    const d = typeof r.check_date === 'string'
      ? r.check_date
      : `${r.check_date.getFullYear()}-${String(r.check_date.getMonth() + 1).padStart(2, '0')}-${String(r.check_date.getDate()).padStart(2, '0')}`
    if (!dateMap.has(d)) dateMap.set(d, new Map())
    dateMap.get(d)!.set(r.item_id, true)
  }

  // Build full date range response
  const result: any[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  for (let d = new Date(end); d >= start; d.setDate(d.getDate() - 1)) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const checkedMap = dateMap.get(ds) || new Map()
    result.push({
      date: ds,
      items: activeItems.map((item: any) => ({
        item_id: item.id,
        title: item.title,
        icon: item.icon,
        checked: checkedMap.has(item.id),
      })),
    })
  }

  return { success: true, data: result }
})
