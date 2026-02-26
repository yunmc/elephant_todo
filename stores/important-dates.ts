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
    repeat_yearly?: boolean
    remind_days_before?: number
    icon?: string
    note?: string
  }) {
    const res = await api.post<ImportantDate>('/important-dates', data)
    if (res.data) {
      dates.value.push(res.data)
      // Re-fetch to get correct days_until and sorting
      await fetchDates()
    }
    return res.data
  }

  async function updateDate(id: number, data: Record<string, any>) {
    const res = await api.put<ImportantDate>(`/important-dates/${id}`, data)
    if (res.data) {
      const idx = dates.value.findIndex((d) => d.id === id)
      if (idx !== -1) dates.value[idx] = res.data
      await fetchDates()
    }
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
