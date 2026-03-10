import { defineStore } from 'pinia'
import type { Tag } from '~/types'

export const useTagsStore = defineStore('tags', () => {
  const api = useApi()

  const tags = ref<Tag[]>([])
  const loading = ref(false)

  async function fetchTags() {
    loading.value = true
    try {
      const res = await api.get<Tag[]>('/tags')
      tags.value = res.data || []
    } finally {
      loading.value = false
    }
  }

  async function createTag(data: { name: string; color?: string }) {
    const res = await api.post<Tag>('/tags', data)
    if (res.data) {
      tags.value.push(res.data)
    }
    return res.data
  }

  async function updateTag(id: number, data: { name: string; color?: string }) {
    const res = await api.put<Tag>(`/tags/${id}`, data)
    if (res.data) {
      const idx = tags.value.findIndex((t) => t.id === id)
      if (idx !== -1) tags.value[idx] = res.data
    }
    return res.data
  }

  async function deleteTag(id: number) {
    await api.delete(`/tags/${id}`)
    tags.value = tags.value.filter((t) => t.id !== id)
  }

  return {
    tags,
    loading,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
  }
})
