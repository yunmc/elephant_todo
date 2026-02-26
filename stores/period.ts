import { defineStore } from 'pinia'
import type { PeriodRecord, PeriodPrediction } from '~/types'

export const usePeriodStore = defineStore('period', () => {
  const api = useApi()

  const records = ref<PeriodRecord[]>([])
  const prediction = ref<PeriodPrediction | null>(null)
  const loading = ref(false)
  const personNames = ref<string[]>([])
  const selectedPerson = ref<string>('我')

  async function fetchPersonNames() {
    try {
      const res = await api.get<string[]>('/period/persons')
      personNames.value = res.data || []
      // If current selection is not in the list and list is non-empty, default to first
      if (personNames.value.length > 0 && !personNames.value.includes(selectedPerson.value)) {
        selectedPerson.value = personNames.value[0]
      }
    } catch {
      // ignore
    }
  }

  async function fetchRecords() {
    loading.value = true
    try {
      const res = await api.get<PeriodRecord[]>('/period', { person_name: selectedPerson.value })
      records.value = res.data || []
    } finally {
      loading.value = false
    }
  }

  async function createRecord(data: {
    person_name?: string
    start_date: string
    end_date?: string
    flow_level?: 'light' | 'moderate' | 'heavy'
    symptoms?: string[]
    note?: string
  }) {
    const res = await api.post<PeriodRecord>('/period', data)
    if (res.data) {
      await fetchPersonNames()
      await fetchRecords()
      await fetchPrediction()
    }
    return res.data
  }

  async function updateRecord(id: number, data: Record<string, any>) {
    const res = await api.put<PeriodRecord>(`/period/${id}`, data)
    if (res.data) {
      await fetchRecords()
      await fetchPrediction()
    }
    return res.data
  }

  async function deleteRecord(id: number) {
    await api.delete(`/period/${id}`)
    await fetchPersonNames()
    await fetchRecords()
    await fetchPrediction()
  }

  async function fetchPrediction() {
    try {
      const res = await api.get<PeriodPrediction>('/period/predict', { person_name: selectedPerson.value })
      prediction.value = res.data || null
    } catch {
      prediction.value = null
    }
  }

  async function switchPerson(name: string) {
    selectedPerson.value = name
    await Promise.all([fetchRecords(), fetchPrediction()])
  }

  return {
    records, prediction, loading, personNames, selectedPerson,
    fetchRecords, createRecord, updateRecord, deleteRecord, fetchPrediction,
    fetchPersonNames, switchPerson,
  }
})
