import { defineStore } from 'pinia'
import type { PeriodRecord, PeriodPrediction } from '~/types'

export const usePeriodStore = defineStore('period', () => {
  const api = useApi()

  const records = ref<PeriodRecord[]>([])
  const prediction = ref<PeriodPrediction | null>(null)
  const loading = ref(false)

  async function fetchRecords() {
    loading.value = true
    try {
      const res = await api.get<PeriodRecord[]>('/period')
      records.value = res.data || []
    } finally {
      loading.value = false
    }
  }

  async function createRecord(data: {
    start_date: string
    end_date?: string
    flow_level?: 'light' | 'moderate' | 'heavy'
    symptoms?: string[]
    mood?: string
    note?: string
  }) {
    const res = await api.post<PeriodRecord>('/period', data)
    if (res.data) {
      records.value.unshift(res.data)
      await fetchRecords()
      await fetchPrediction()
    }
    return res.data
  }

  async function updateRecord(id: number, data: Record<string, any>) {
    const res = await api.put<PeriodRecord>(`/period/${id}`, data)
    if (res.data) {
      const idx = records.value.findIndex((r) => r.id === id)
      if (idx !== -1) records.value[idx] = res.data
      await fetchRecords()
      await fetchPrediction()
    }
    return res.data
  }

  async function deleteRecord(id: number) {
    await api.delete(`/period/${id}`)
    records.value = records.value.filter((r) => r.id !== id)
    await fetchPrediction()
  }

  async function fetchPrediction() {
    try {
      const res = await api.get<PeriodPrediction>('/period/predict')
      prediction.value = res.data || null
    } catch {
      prediction.value = null
    }
  }

  return {
    records, prediction, loading,
    fetchRecords, createRecord, updateRecord, deleteRecord, fetchPrediction,
  }
})
