import { defineStore } from 'pinia'
import type { FinanceRecord, FinanceCategory, FinanceFilters, FinanceStatistics, FinanceTrendItem, Pagination, FinanceBudget, BudgetProgress } from '~/types'

export const useFinanceStore = defineStore('finance', () => {
  const api = useApi()

  const records = ref<FinanceRecord[]>([])
  const categories = ref<FinanceCategory[]>([])
  const statistics = ref<FinanceStatistics | null>(null)
  const pagination = ref<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const filters = ref<FinanceFilters>({})
  const loading = ref(false)

  // ==================== Categories ====================
  async function fetchCategories() {
    const res = await api.get<FinanceCategory[]>('/finance/categories')
    categories.value = res.data || []
  }

  async function createCategory(data: { name: string; icon?: string; type: 'income' | 'expense'; sort_order?: number }) {
    const res = await api.post<FinanceCategory>('/finance/categories', data)
    if (res.data) categories.value.push(res.data)
    return res.data
  }

  async function updateCategory(id: number, data: Partial<FinanceCategory>) {
    const res = await api.put<FinanceCategory>(`/finance/categories/${id}`, data)
    if (res.data) {
      const idx = categories.value.findIndex((c) => c.id === id)
      if (idx !== -1) categories.value[idx] = res.data
    }
    return res.data
  }

  async function deleteCategory(id: number) {
    await api.delete(`/finance/categories/${id}`)
    categories.value = categories.value.filter((c) => c.id !== id)
  }

  // ==================== Records ====================
  async function fetchRecords() {
    loading.value = true
    try {
      const res = await api.get<FinanceRecord[]>('/finance/records', {
        ...filters.value,
        page: pagination.value.page,
        limit: pagination.value.limit,
      })
      records.value = res.data || []
      if (res.pagination) pagination.value = res.pagination
    } finally {
      loading.value = false
    }
  }

  async function createRecord(data: { category_id?: number; type: 'income' | 'expense'; amount: number; note?: string; record_date: string }) {
    const res = await api.post<FinanceRecord>('/finance/records', data)
    if (res.data) records.value.unshift(res.data)
    return res.data
  }

  async function updateRecord(id: number, data: Record<string, any>) {
    const res = await api.put<FinanceRecord>(`/finance/records/${id}`, data)
    if (res.data) {
      const idx = records.value.findIndex((r) => r.id === id)
      if (idx !== -1) records.value[idx] = res.data
    }
    return res.data
  }

  async function deleteRecord(id: number) {
    await api.delete(`/finance/records/${id}`)
    records.value = records.value.filter((r) => r.id !== id)
  }

  // ==================== Statistics ====================
  async function fetchStatistics(startDate?: string, endDate?: string) {
    const params: any = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    const res = await api.get<FinanceStatistics>('/finance/statistics', params)
    statistics.value = res.data || null
    return statistics.value
  }

  // ==================== Helpers ====================
  function setFilters(newFilters: Partial<FinanceFilters>) {
    filters.value = { ...filters.value, ...newFilters }
    pagination.value.page = 1
  }

  function setPage(page: number) {
    pagination.value.page = page
  }

  // ==================== Budgets ====================
  const budgets = ref<FinanceBudget[]>([])
  const budgetProgress = ref<BudgetProgress | null>(null)

  async function fetchBudgets(yearMonth: string) {
    const res = await api.get<FinanceBudget[]>('/finance/budgets', { year_month: yearMonth })
    budgets.value = res.data || []
    return budgets.value
  }

  async function saveBudget(data: { category_id?: number | null; year_month: string; amount: number }) {
    const res = await api.post<FinanceBudget[]>('/finance/budgets', data)
    budgets.value = res.data || []
    return budgets.value
  }

  async function deleteBudget(id: number) {
    await api.delete(`/finance/budgets/${id}`)
    budgets.value = budgets.value.filter(b => b.id !== id)
  }

  async function fetchBudgetProgress(yearMonth: string) {
    const res = await api.get<BudgetProgress>('/finance/budgets/progress', { year_month: yearMonth })
    budgetProgress.value = res.data || null
    return budgetProgress.value
  }

  // ==================== Chart Statistics ====================
  const trend = ref<FinanceTrendItem[]>([])

  async function fetchTrend(months: number = 6) {
    const res = await api.get<FinanceTrendItem[]>('/finance/statistics/trend', { months })
    trend.value = res.data || []
  }

  return {
    records, categories, statistics, pagination, filters, loading,
    budgets, budgetProgress, trend,
    fetchCategories, createCategory, updateCategory, deleteCategory,
    fetchRecords, createRecord, updateRecord, deleteRecord,
    fetchStatistics, setFilters, setPage,
    fetchBudgets, saveBudget, deleteBudget, fetchBudgetProgress,
    fetchTrend,
  }
})
