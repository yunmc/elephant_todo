import { defineStore } from 'pinia'
import type { ImportantDate } from '~/types'

export const useImportantDatesStore = defineStore('important-dates', () => {
  const api = useApi()

  const dates = ref<ImportantDate[]>([])
  const loading = ref(false)

  async function fetchDates() {
    loading.value = true
    try {
      const res = await api.get<ImportantDate[]>('/important-dates')
      dates.value = res.data || []
    } finally {
      loading.value = false
    }
  }

  async function createDate(data: {
    title: string
    date: string
    is_lunar?: boolean
    repeat_type?: 'none' | 'monthly' | 'yearly'
    remind_days_before?: number
    icon?: string
    note?: string
  }) {
    const res = await api.post<ImportantDate>('/important-dates', data)
    // Re-fetch to get correct days_until and sorting
    await fetchDates()
    return res.data
  }

  async function updateDate(id: number, data: Record<string, any>) {
    const res = await api.put<ImportantDate>(`/important-dates/${id}`, data)
    await fetchDates()
    return res.data
  }

  async function deleteDate(id: number) {
    await api.delete(`/important-dates/${id}`)
    dates.value = dates.value.filter((d) => d.id !== id)
  }

  return {
    dates, loading,
    fetchDates, createDate, updateDate, deleteDate,
  }
})
