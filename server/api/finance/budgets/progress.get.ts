const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  await requirePremium(userId)

  const query = getQuery(event)
  const yearMonth = query.year_month as string

  if (!yearMonth || !YEAR_MONTH_REGEX.test(yearMonth)) {
    throw createError({ statusCode: 400, message: 'year_month 格式必须为 YYYY-MM' })
  }

  const { budgets, spending } = await FinanceBudgetModel.getProgress(userId, yearMonth)

  if (budgets.length === 0) {
    return { success: true, data: null }
  }

  // 构建 spending map: category_id → spent
  const spendMap = new Map<number | null, number>()
  for (const s of spending) {
    spendMap.set(s.category_id, s.spent)
  }

  // 计算总支出（所有分类）
  let totalSpent = 0
  for (const s of spending) {
    totalSpent += s.spent
  }

  // 总预算（category_id = null 的条目）
  const totalBudgetEntry = budgets.find(b => b.category_id === null)
  const totalBudget = totalBudgetEntry ? Number(totalBudgetEntry.amount) : 0

  // 本月剩余天数
  const [year, month] = yearMonth.split('-').map(Number)
  const now = new Date()
  const lastDay = new Date(year, month, 0).getDate()
  const isCurrentMonth = now.getFullYear() === year && (now.getMonth() + 1) === month
  const today = isCurrentMonth ? now.getDate() : lastDay
  const daysLeft = Math.max(lastDay - today, 0)

  const percentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0
  const remaining = totalBudget - totalSpent
  const dailyRemaining = daysLeft > 0 ? Math.round((remaining / daysLeft) * 100) / 100 : 0

  // 分类预算进度
  const categories = budgets
    .filter(b => b.category_id !== null)
    .map(b => {
      const budget = Number(b.amount)
      const spent = spendMap.get(b.category_id) || 0
      const pct = budget > 0 ? Math.round((spent / budget) * 1000) / 10 : 0
      return {
        category_id: b.category_id,
        category_name: b.category_name || '未分类',
        category_icon: b.category_icon || '💰',
        budget,
        spent,
        percentage: pct,
        status: pct >= 100 ? 'over' : pct >= 80 ? 'warning' : 'normal' as 'normal' | 'warning' | 'over',
      }
    })

  return {
    success: true,
    data: {
      total_budget: totalBudget,
      total_spent: totalSpent,
      percentage,
      remaining,
      days_left: daysLeft,
      daily_remaining: dailyRemaining,
      categories,
    },
  }
})
