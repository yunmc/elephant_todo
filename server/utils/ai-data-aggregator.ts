import type { RowDataPacket } from 'mysql2'

// ==================== Monthly Data ====================
export interface MonthlyData {
  finance: {
    totalIncome: number
    totalExpense: number
    prevMonthExpense: number
    categoryBreakdown: Array<{ name: string, amount: number, count: number }>
  }
  todos: {
    created: number
    completed: number
    overdue: number
    prevMonthCompletionRate: number
  }
  ideas: {
    total: number
    linkedCount: number
  }
  importantDates: {
    thisMonth: string[]
    nextMonth: string[]
  }
}

// ==================== Yearly Data ====================
export interface YearlyData {
  finance: {
    totalIncome: number
    totalExpense: number
    monthlyExpenses: Array<{ month: number, amount: number }>
    topCategories: Array<{ name: string, amount: number, percentage: number }>
  }
  todos: {
    totalCreated: number
    totalCompleted: number
    completionRate: number
    busiestMonth: number
    mostEfficientMonth: { month: number, rate: number }
  }
  ideas: {
    total: number
    busiestMonth: { month: number, count: number }
  }
}

/**
 * 获取月份的起止日期
 */
function getMonthRange(year: number, month: number): { start: string, end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  // 月末：下个月第0天 = 当月最后一天
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

/**
 * 聚合月度数据
 */
export async function aggregateMonthlyData(userId: number, year: number, month: number): Promise<MonthlyData> {
  const db = getDb()
  const { start: monthStart, end: monthEnd } = getMonthRange(year, month)

  // 上月
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth)

  // 下月（用于重要日期提醒）
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  // 并行执行所有查询
  const [
    financeTypeRows,
    prevExpenseRows,
    categoryRows,
    todoStatsRows,
    prevTodoRows,
    ideaRows,
    dateRows,
  ] = await Promise.all([
    // 当月消费统计
    db.query<RowDataPacket[]>(
      'SELECT type, SUM(amount) as total FROM finance_records WHERE user_id = ? AND record_date BETWEEN ? AND ? GROUP BY type',
      [userId, monthStart, monthEnd],
    ),
    // 上月消费（环比对比）
    db.query<RowDataPacket[]>(
      'SELECT SUM(amount) as total FROM finance_records WHERE user_id = ? AND record_date BETWEEN ? AND ? AND type = \'expense\'',
      [userId, prevStart, prevEnd],
    ),
    // 分类明细
    db.query<RowDataPacket[]>(
      `SELECT fc.name, COUNT(*) as count, SUM(fr.amount) as amount
       FROM finance_records fr JOIN finance_categories fc ON fr.category_id = fc.id
       WHERE fr.user_id = ? AND fr.record_date BETWEEN ? AND ? AND fr.type = 'expense'
       GROUP BY fr.category_id ORDER BY amount DESC`,
      [userId, monthStart, monthEnd],
    ),
    // 当月待办统计
    db.query<RowDataPacket[]>(
      `SELECT
        (SELECT COUNT(*) FROM todos WHERE user_id = ? AND created_at BETWEEN ? AND ?) as created,
        (SELECT COUNT(*) FROM todos WHERE user_id = ? AND completed_at BETWEEN ? AND ?) as completed,
        (SELECT COUNT(*) FROM todos WHERE user_id = ? AND status = 'pending' AND due_date IS NOT NULL AND due_date < ?) as overdue`,
      [userId, monthStart, monthEnd, userId, monthStart, monthEnd, userId, monthEnd],
    ),
    // 上月待办完成率
    db.query<RowDataPacket[]>(
      `SELECT
        (SELECT COUNT(*) FROM todos WHERE user_id = ? AND created_at BETWEEN ? AND ?) as created,
        (SELECT COUNT(*) FROM todos WHERE user_id = ? AND completed_at BETWEEN ? AND ?) as completed`,
      [userId, prevStart, prevEnd, userId, prevStart, prevEnd],
    ),
    // 随手记统计
    db.query<RowDataPacket[]>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN todo_id IS NOT NULL THEN 1 ELSE 0 END) as linked
       FROM ideas WHERE user_id = ? AND created_at BETWEEN ? AND ?`,
      [userId, monthStart, monthEnd],
    ),
    // 重要日期（本月+下月）
    db.query<RowDataPacket[]>(
      `SELECT title, event_date FROM important_dates
       WHERE user_id = ? AND (
         (MONTH(event_date) = ? AND YEAR(event_date) = ?) OR
         (MONTH(event_date) = ? AND YEAR(event_date) = ?)
       )`,
      [userId, month, year, nextMonth, nextYear],
    ),
  ])

  // 解析消费统计
  let totalIncome = 0
  let totalExpense = 0
  for (const row of financeTypeRows[0]) {
    if (row.type === 'income') totalIncome = Number(row.total) || 0
    if (row.type === 'expense') totalExpense = Number(row.total) || 0
  }

  const prevMonthExpense = Number(prevExpenseRows[0][0]?.total) || 0

  const categoryBreakdown = categoryRows[0].map((r: any) => ({
    name: r.name,
    amount: Number(r.amount) || 0,
    count: Number(r.count) || 0,
  }))

  // 解析待办统计
  const todoStats = todoStatsRows[0][0] || { created: 0, completed: 0, overdue: 0 }
  const prevTodo = prevTodoRows[0][0] || { created: 0, completed: 0 }
  const prevMonthCompletionRate = prevTodo.created > 0
    ? Math.round((prevTodo.completed / prevTodo.created) * 100)
    : 0

  // 解析随手记
  const ideaStats = ideaRows[0][0] || { total: 0, linked: 0 }

  // 解析重要日期
  const thisMonthDates: string[] = []
  const nextMonthDates: string[] = []
  for (const row of dateRows[0]) {
    const d = new Date(row.event_date)
    const m = d.getMonth() + 1
    if (m === month) {
      thisMonthDates.push(row.title)
    } else {
      nextMonthDates.push(row.title)
    }
  }

  return {
    finance: {
      totalIncome,
      totalExpense,
      prevMonthExpense,
      categoryBreakdown,
    },
    todos: {
      created: Number(todoStats.created) || 0,
      completed: Number(todoStats.completed) || 0,
      overdue: Number(todoStats.overdue) || 0,
      prevMonthCompletionRate,
    },
    ideas: {
      total: Number(ideaStats.total) || 0,
      linkedCount: Number(ideaStats.linked) || 0,
    },
    importantDates: {
      thisMonth: thisMonthDates,
      nextMonth: nextMonthDates,
    },
  }
}

/**
 * 聚合年度数据
 */
export async function aggregateYearlyData(userId: number, year: number): Promise<YearlyData> {
  const db = getDb()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const [
    financeYearRows,
    monthlyExpenseRows,
    topCategoryRows,
    todoYearRows,
    todoMonthlyRows,
    ideaYearRows,
    ideaMonthlyRows,
  ] = await Promise.all([
    // 年度收支总计
    db.query<RowDataPacket[]>(
      'SELECT type, SUM(amount) as total FROM finance_records WHERE user_id = ? AND record_date BETWEEN ? AND ? GROUP BY type',
      [userId, yearStart, yearEnd],
    ),
    // 月度支出趋势
    db.query<RowDataPacket[]>(
      'SELECT MONTH(record_date) as month, SUM(amount) as amount FROM finance_records WHERE user_id = ? AND record_date BETWEEN ? AND ? AND type = \'expense\' GROUP BY MONTH(record_date) ORDER BY month',
      [userId, yearStart, yearEnd],
    ),
    // TOP 分类
    db.query<RowDataPacket[]>(
      `SELECT fc.name, SUM(fr.amount) as amount
       FROM finance_records fr JOIN finance_categories fc ON fr.category_id = fc.id
       WHERE fr.user_id = ? AND fr.record_date BETWEEN ? AND ? AND fr.type = 'expense'
       GROUP BY fr.category_id ORDER BY amount DESC LIMIT 5`,
      [userId, yearStart, yearEnd],
    ),
    // 年度待办总计
    db.query<RowDataPacket[]>(
      `SELECT
        (SELECT COUNT(*) FROM todos WHERE user_id = ? AND created_at BETWEEN ? AND ?) as created,
        (SELECT COUNT(*) FROM todos WHERE user_id = ? AND completed_at BETWEEN ? AND ?) as completed`,
      [userId, yearStart, yearEnd, userId, yearStart, yearEnd],
    ),
    // 月度待办 (创建+完成)
    db.query<RowDataPacket[]>(
      `SELECT
        MONTH(created_at) as month,
        COUNT(*) as created,
        SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed
       FROM todos WHERE user_id = ? AND created_at BETWEEN ? AND ?
       GROUP BY MONTH(created_at)`,
      [userId, yearStart, yearEnd],
    ),
    // 年度随手记总计
    db.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM ideas WHERE user_id = ? AND created_at BETWEEN ? AND ?',
      [userId, yearStart, yearEnd],
    ),
    // 月度随手记
    db.query<RowDataPacket[]>(
      'SELECT MONTH(created_at) as month, COUNT(*) as count FROM ideas WHERE user_id = ? AND created_at BETWEEN ? AND ? GROUP BY MONTH(created_at)',
      [userId, yearStart, yearEnd],
    ),
  ])

  // 解析年度收支
  let totalIncome = 0
  let totalExpense = 0
  for (const row of financeYearRows[0]) {
    if (row.type === 'income') totalIncome = Number(row.total) || 0
    if (row.type === 'expense') totalExpense = Number(row.total) || 0
  }

  // 月度支出
  const monthlyExpenses = monthlyExpenseRows[0].map((r: any) => ({
    month: Number(r.month),
    amount: Number(r.amount) || 0,
  }))

  // TOP 分类（含百分比）
  const topCategories = topCategoryRows[0].map((r: any) => ({
    name: r.name,
    amount: Number(r.amount) || 0,
    percentage: totalExpense > 0 ? Math.round((Number(r.amount) / totalExpense) * 100) : 0,
  }))

  // 年度待办
  const todoYear = todoYearRows[0][0] || { created: 0, completed: 0 }
  const totalCreated = Number(todoYear.created) || 0
  const totalCompleted = Number(todoYear.completed) || 0
  const completionRate = totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0

  // 月度待办分析
  let busiestMonth = 1
  let maxCreated = 0
  let mostEfficientMonth = { month: 1, rate: 0 }

  for (const row of todoMonthlyRows[0]) {
    const created = Number(row.created) || 0
    const completed = Number(row.completed) || 0
    const m = Number(row.month)

    if (created > maxCreated) {
      maxCreated = created
      busiestMonth = m
    }

    const rate = created > 0 ? Math.round((completed / created) * 100) : 0
    if (rate > mostEfficientMonth.rate) {
      mostEfficientMonth = { month: m, rate }
    }
  }

  // 年度随手记
  const ideasTotal = Number(ideaYearRows[0][0]?.total) || 0
  let busiestIdeaMonth = { month: 1, count: 0 }
  for (const row of ideaMonthlyRows[0]) {
    const count = Number(row.count) || 0
    if (count > busiestIdeaMonth.count) {
      busiestIdeaMonth = { month: Number(row.month), count }
    }
  }

  return {
    finance: {
      totalIncome,
      totalExpense,
      monthlyExpenses,
      topCategories,
    },
    todos: {
      totalCreated,
      totalCompleted,
      completionRate,
      busiestMonth,
      mostEfficientMonth,
    },
    ideas: {
      total: ideasTotal,
      busiestMonth: busiestIdeaMonth,
    },
  }
}
