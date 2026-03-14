const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const query = getQuery(event)

  const months = Math.min(Math.max(Number(query.months) || 6, 1), 12)

  // Calculate date range
  const now = new Date()
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const startMonth = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
  const startDate = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}-01`

  const data = await FinanceRecordModel.getTrend(userId, startDate, endDate)

  // Fill missing months with zeros
  const result: { month: string; income: number; expense: number; balance: number }[] = []
  const cursor = new Date(startMonth)
  for (let i = 0; i < months; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const found = data.find(d => d.month === key)
    result.push({
      month: key,
      income: found ? found.income : 0,
      expense: found ? found.expense : 0,
      balance: found ? found.income - found.expense : 0,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return { success: true, data: result }
})
