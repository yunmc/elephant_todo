import { defineStore } from 'pinia'
import type { Category } from '~/types'

export const useCategoriesStore = defineStore('categories', () => {
  const api = useApi()

  const categories = ref<Category[]>([])
  const loading = ref(false)

  async function fetchCategories() {
    loading.value = true
    try {
      const res = await api.get<Category[]>('/categories')
      categories.value = res.data || []
    } finally {
      loading.value = false
    }
  }

  async function createCategory(data: { name: string; color?: string }) {
    const res = await api.post<Category>('/categories', data)
    if (res.data) {
      categories.value.push(res.data)
    }
    return res.data
  }

  async function updateCategory(id: number, data: { name?: string; color?: string }) {
    const res = await api.put<Category>(`/categories/${id}`, data)
    if (res.data) {
      const idx = categories.value.findIndex((c) => c.id === id)
      if (idx !== -1) categories.value[idx] = res.data
    }
    return res.data
  }

  async function deleteCategory(id: number) {
    await api.delete(`/categories/${id}`)
    categories.value = categories.value.filter((c) => c.id !== id)
  }

  return {
    categories,
    loading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  }
})
