import { defineStore } from 'pinia'
import type { Idea, IdeaFilters, Pagination, SmartSuggestResult } from '~/types'

export const useIdeasStore = defineStore('ideas', () => {
  const api = useApi()

  const ideas = ref<Idea[]>([])
  const currentIdea = ref<Idea | null>(null)
  const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const filters = ref<IdeaFilters>({})
  const loading = ref(false)

  async function fetchIdeas() {
    loading.value = true
    try {
      const res = await api.get<Idea[]>('/ideas', {
        ...filters.value,
        page: pagination.value.page,
        limit: pagination.value.limit,
      })
      ideas.value = res.data || []
      if (res.pagination) pagination.value = res.pagination
    } finally {
      loading.value = false
    }
  }

  async function fetchIdea(id: number) {
    loading.value = true
    try {
      const res = await api.get<Idea>(`/ideas/${id}`)
      currentIdea.value = res.data || null
      return currentIdea.value
    } finally {
      loading.value = false
    }
  }

  async function createIdea(data: { content: string; source?: 'text' | 'voice'; todo_id?: number }) {
    const res = await api.post<Idea>('/ideas', data)
    if (res.data) {
      ideas.value.unshift(res.data)
    }
    return res.data
  }

  async function updateIdea(id: number, data: { content?: string }) {
    const res = await api.put<Idea>(`/ideas/${id}`, data)
    if (res.data) {
      const idx = ideas.value.findIndex((i) => i.id === id)
      if (idx !== -1) ideas.value[idx] = res.data
      if (currentIdea.value?.id === id) currentIdea.value = res.data
    }
    return res.data
  }

  async function deleteIdea(id: number) {
    await api.delete(`/ideas/${id}`)
    ideas.value = ideas.value.filter((i) => i.id !== id)
    if (currentIdea.value?.id === id) currentIdea.value = null
  }

  async function linkToTodo(ideaId: number, todoId: number) {
    const res = await api.post<Idea>(`/ideas/${ideaId}/link`, { todo_id: todoId })
    if (res.data) {
      const idx = ideas.value.findIndex((i) => i.id === ideaId)
      if (idx !== -1) ideas.value[idx] = res.data
    }
    return res.data
  }

  async function unlinkFromTodo(ideaId: number) {
    const res = await api.post<Idea>(`/ideas/${ideaId}/unlink`)
    if (res.data) {
      const idx = ideas.value.findIndex((i) => i.id === ideaId)
      if (idx !== -1) ideas.value[idx] = res.data
    }
    return res.data
  }

  async function convertToTodo(ideaId: number) {
    const res = await api.post(`/ideas/${ideaId}/convert`)
    return res.data
  }

  async function smartSuggest(text: string): Promise<SmartSuggestResult> {
    const res = await api.post<SmartSuggestResult>('/match/smart-suggest', { text })
    return res.data || { similar_todos: [] }
  }

  function setFilters(newFilters: Partial<IdeaFilters>) {
    filters.value = { ...filters.value, ...newFilters }
    pagination.value.page = 1
  }

  function setPage(page: number) {
    pagination.value.page = page
  }

  return {
    ideas,
    currentIdea,
    pagination,
    filters,
    loading,
    fetchIdeas,
    fetchIdea,
    createIdea,
    updateIdea,
    deleteIdea,
    linkToTodo,
    unlinkFromTodo,
    convertToTodo,
    smartSuggest,
    setFilters,
    setPage,
  }
})
