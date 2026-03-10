import { defineStore } from 'pinia'
import type { ChecklistItem, ChecklistTodayItem, ChecklistStats, ChecklistDayRecord } from '~/types'

export const useChecklistStore = defineStore('checklist', () => {
  const api = useApi()

  const items = ref<ChecklistItem[]>([])
  const todayItems = ref<ChecklistTodayItem[]>([])
  const history = ref<ChecklistDayRecord[]>([])
  const stats = ref<ChecklistStats | null>(null)
  const loading = ref(false)
  const currentDate = ref(formatDate(new Date()))

  // ==================== 习惯项管理 ====================

  async function fetchItems() {
    loading.value = true
    try {
      const res = await api.get<ChecklistItem[]>('/checklist/items')
      items.value = res.data || []
    } finally {
      loading.value = false
    }
  }

  async function createItem(data: { title: string; icon?: string }) {
    const res = await api.post<ChecklistItem>('/checklist/items', data)
    if (res.data) items.value.push(res.data)
    return res.data
  }

  async function updateItem(id: number, data: { title?: string; icon?: string; is_active?: boolean }) {
    const res = await api.put<ChecklistItem>(`/checklist/items/${id}`, data)
    if (res.data) {
      const idx = items.value.findIndex(i => i.id === id)
      if (idx !== -1) items.value[idx] = res.data
    }
    return res.data
  }

  async function deleteItem(id: number) {
    await api.delete(`/checklist/items/${id}`)
    items.value = items.value.filter(i => i.id !== id)
  }

  async function reorderItems(itemIds: number[]) {
    await api.put('/checklist/items/reorder', { item_ids: itemIds })
  }

  // ==================== 打卡操作 ====================

  async function fetchToday(date?: string) {
    const d = date || currentDate.value
    loading.value = true
    try {
      const res = await api.get<ChecklistTodayItem[]>('/checklist/today', { date: d })
      todayItems.value = res.data || []
    } finally {
      loading.value = false
    }
  }

  async function toggleCheck(itemId: number, date?: string) {
    const d = date || currentDate.value
    const item = todayItems.value.find(i => i.id === itemId)
    if (!item) return

    // Optimistic update
    const wasChecked = item.checked
    item.checked = !wasChecked
    item.checked_at = wasChecked ? null : new Date().toISOString()

    try {
      if (wasChecked) {
        await api.post('/checklist/uncheck', { item_id: itemId, date: d })
      } else {
        await api.post('/checklist/check', { item_id: itemId, date: d })
      }
    } catch {
      // Rollback on failure
      item.checked = wasChecked
      item.checked_at = wasChecked ? item.checked_at : null
    }
  }

  // ==================== 历史与统计 ====================

  async function fetchHistory(startDate: string, endDate: string) {
    const res = await api.get<ChecklistDayRecord[]>('/checklist/history', {
      start_date: startDate,
      end_date: endDate,
    })
    history.value = res.data || []
    return history.value
  }

  async function fetchStats(days: number = 30) {
    const res = await api.get<ChecklistStats>('/checklist/stats', { days })
    stats.value = res.data || null
    return stats.value
  }

  function setDate(date: string) {
    currentDate.value = date
  }

  return {
    items,
    todayItems,
    history,
    stats,
    loading,
    currentDate,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
    fetchToday,
    toggleCheck,
    fetchHistory,
    fetchStats,
    setDate,
  }
})

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
