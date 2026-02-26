import { defineStore } from 'pinia'
import type { Todo, TodoFilters, Pagination } from '~/types'

export const useTodosStore = defineStore('todos', () => {
  const api = useApi()

  const todos = ref<Todo[]>([])
  const currentTodo = ref<Todo | null>(null)
  const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const filters = ref<TodoFilters>({ status: 'pending', sort_by: 'created_at', sort_order: 'desc' })
  const loading = ref(false)

  async function fetchTodos() {
    loading.value = true
    try {
      const res = await api.get<Todo[]>('/todos', {
        ...filters.value,
        page: pagination.value.page,
        limit: pagination.value.limit,
      })
      todos.value = res.data || []
      if (res.pagination) pagination.value = res.pagination
    } finally {
      loading.value = false
    }
  }

  async function fetchTodo(id: number) {
    loading.value = true
    try {
      const res = await api.get<Todo>(`/todos/${id}`)
      currentTodo.value = res.data || null
      return currentTodo.value
    } finally {
      loading.value = false
    }
  }

  async function createTodo(data: { title: string; description?: string; priority?: string; category_id?: number; due_date?: string; tag_ids?: number[] }) {
    const res = await api.post<Todo>('/todos', data)
    if (res.data) {
      todos.value.unshift(res.data)
    }
    return res.data
  }

  async function updateTodo(id: number, data: Record<string, any>) {
    const res = await api.put<Todo>(`/todos/${id}`, data)
    if (res.data) {
      const idx = todos.value.findIndex((t) => t.id === id)
      if (idx !== -1) todos.value[idx] = res.data
      if (currentTodo.value?.id === id) currentTodo.value = res.data
    }
    return res.data
  }

  async function deleteTodo(id: number) {
    await api.delete(`/todos/${id}`)
    todos.value = todos.value.filter((t) => t.id !== id)
    if (currentTodo.value?.id === id) currentTodo.value = null
  }

  async function toggleTodo(id: number) {
    const res = await api.patch<Todo>(`/todos/${id}/toggle`)
    if (res.data) {
      const idx = todos.value.findIndex((t) => t.id === id)
      if (idx !== -1) todos.value[idx] = res.data
      if (currentTodo.value?.id === id) currentTodo.value = res.data
    }
    return res.data
  }

  async function fetchTodoIdeas(id: number) {
    const res = await api.get(`/todos/${id}/ideas`)
    return res.data || []
  }

  function setFilters(newFilters: Partial<TodoFilters>) {
    filters.value = { ...filters.value, ...newFilters }
    pagination.value.page = 1
  }

  function setPage(page: number) {
    pagination.value.page = page
  }

  return {
    todos,
    currentTodo,
    pagination,
    filters,
    loading,
    fetchTodos,
    fetchTodo,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    fetchTodoIdeas,
    setFilters,
    setPage,
  }
})
