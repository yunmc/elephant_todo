import { defineStore } from 'pinia'
import type { VaultGroup, VaultEntry, VaultDecryptedData, Pagination } from '~/types'

export const useVaultStore = defineStore('vault', () => {
  const api = useApi()
  const { encrypt, decrypt, generatePassword: genPwd } = useVaultCrypto()

  const groups = ref<VaultGroup[]>([])
  const entries = ref<VaultEntry[]>([])
  const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const selectedGroupId = ref<number | null>(null)
  const loading = ref(false)

  // ==================== Groups ====================
  async function fetchGroups() {
    loading.value = true
    try {
      const res = await api.get<VaultGroup[]>('/vault/groups')
      groups.value = res.data || []
    } finally {
      loading.value = false
    }
  }

  async function createGroup(data: { name: string; icon?: string }) {
    const res = await api.post<VaultGroup>('/vault/groups', data)
    if (res.data) {
      groups.value.push(res.data)
    }
    return res.data
  }

  async function updateGroup(id: number, data: { name?: string; icon?: string; sort_order?: number }) {
    const res = await api.put<VaultGroup>(`/vault/groups/${id}`, data)
    if (res.data) {
      const idx = groups.value.findIndex((g) => g.id === id)
      if (idx !== -1) groups.value[idx] = res.data
    }
    return res.data
  }

  async function deleteGroup(id: number) {
    await api.delete(`/vault/groups/${id}`)
    groups.value = groups.value.filter((g) => g.id !== id)
    if (selectedGroupId.value === id) selectedGroupId.value = null
  }

  // ==================== Entries ====================
  async function fetchEntries(groupId?: number) {
    loading.value = true
    try {
      const params: Record<string, any> = {
        page: pagination.value.page,
        limit: pagination.value.limit,
      }
      if (groupId !== undefined) params.group_id = groupId
      const res = await api.get<VaultEntry[]>('/vault/entries', params)
      entries.value = res.data || []
      if (res.pagination) pagination.value = res.pagination
    } finally {
      loading.value = false
    }
  }

  async function createEntry(
    name: string,
    url: string | undefined,
    groupId: number,
    decryptedData: VaultDecryptedData,
    masterPassword: string,
  ) {
    const encrypted_data = await encrypt(decryptedData, masterPassword)
    const res = await api.post<VaultEntry>('/vault/entries', {
      name,
      url,
      group_id: groupId,
      encrypted_data,
    })
    if (res.data) entries.value.unshift(res.data)
    return res.data
  }

  async function updateEntry(
    id: number,
    data: { name?: string; url?: string; group_id?: number | null },
    decryptedData?: VaultDecryptedData,
    masterPassword?: string,
  ) {
    const body: Record<string, any> = { ...data }
    if (decryptedData && masterPassword) {
      body.encrypted_data = await encrypt(decryptedData, masterPassword)
    }
    const res = await api.put<VaultEntry>(`/vault/entries/${id}`, body)
    if (res.data) {
      const idx = entries.value.findIndex((e) => e.id === id)
      if (idx !== -1) entries.value[idx] = res.data
    }
    return res.data
  }

  async function deleteEntry(id: number) {
    await api.delete(`/vault/entries/${id}`)
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  async function decryptEntry(entry: VaultEntry, masterPassword: string): Promise<VaultDecryptedData> {
    return await decrypt(entry.encrypted_data, masterPassword)
  }

  /** Re-encrypt all entries with new password (used when changing login password) */
  async function reEncryptAll(oldPassword: string, newPassword: string) {
    const allEntries = entries.value
    const batchItems = []
    for (const entry of allEntries) {
      const decrypted = await decrypt(entry.encrypted_data, oldPassword)
      const newEncrypted = await encrypt(decrypted, newPassword)
      batchItems.push({ id: entry.id, encrypted_data: newEncrypted })
    }
    if (batchItems.length > 0) {
      await api.put('/vault/entries/batch', { entries: batchItems })
    }
  }

  function generatePassword(options?: {
    length?: number
    uppercase?: boolean
    lowercase?: boolean
    numbers?: boolean
    symbols?: boolean
  }) {
    return genPwd(options)
  }

  function setPage(page: number) {
    pagination.value.page = page
  }

  return {
    groups,
    entries,
    pagination,
    selectedGroupId,
    loading,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    decryptEntry,
    reEncryptAll,
    generatePassword,
    setPage,
  }
})
