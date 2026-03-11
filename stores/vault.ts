import { defineStore } from 'pinia'
import type { VaultGroup, VaultEntry, VaultDecryptedData, Pagination } from '~/types'

export const useVaultStore = defineStore('vault', () => {
  const api = useApi()
  const { encrypt, decrypt, generatePassword: genPwd, generateSalt } = useVaultCrypto()

  const groups = ref<VaultGroup[]>([])
  const entries = ref<VaultEntry[]>([])
  const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const selectedGroupId = ref<number | null>(null)
  const loading = ref(false)
  const vaultSalt = ref<string | null>(null)

  // ==================== Salt ====================
  /** Fetch the user's vault salt from server; null if not set yet */
  async function fetchVaultSalt(): Promise<string | null> {
    const res = await api.get<{ salt: string | null }>('/vault/salt')
    vaultSalt.value = res.data?.salt ?? null
    return vaultSalt.value
  }

  /** Initialize vault salt for a new user (first vault usage) */
  async function initVaultSalt(): Promise<string> {
    const salt = generateSalt()
    try {
      await api.post('/vault/salt', { salt })
      vaultSalt.value = salt
      return salt
    } catch (e: any) {
      // 409 = salt already exists (race condition); re-fetch instead
      if (e?.statusCode === 409 || e?.response?.status === 409) {
        const existing = await fetchVaultSalt()
        if (existing) return existing
      }
      throw e
    }
  }

  /** Ensure salt is available; fetch or create if needed */
  async function ensureSalt(): Promise<string> {
    if (vaultSalt.value) return vaultSalt.value
    const salt = await fetchVaultSalt()
    if (salt) return salt
    return await initVaultSalt()
  }

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

  /** Fetch a single entry by ID (uses dedicated endpoint) */
  async function fetchEntry(id: number): Promise<VaultEntry | null> {
    const res = await api.get<VaultEntry>(`/vault/entries/${id}`)
    return res.data ?? null
  }

  async function createEntry(
    name: string,
    url: string | undefined,
    groupId: number | null,
    decryptedData: VaultDecryptedData,
    masterPassword: string,
  ) {
    const salt = await ensureSalt()
    const encrypted_data = await encrypt(decryptedData, masterPassword, salt)
    const res = await api.post<VaultEntry>('/vault/entries', {
      name,
      url,
      group_id: groupId || undefined,
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
      const salt = await ensureSalt()
      body.encrypted_data = await encrypt(decryptedData, masterPassword, salt)
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
    const salt = await ensureSalt()
    return await decrypt(entry.encrypted_data, masterPassword, salt)
  }

  /** Re-encrypt ALL entries with new password (fetches all pages) */
  async function reEncryptAll(oldPassword: string, newPassword: string) {
    const salt = await ensureSalt()
    // Fetch ALL entries (not just current page)
    const allEntries: VaultEntry[] = []
    let page = 1
    const limit = 100
    while (true) {
      const res = await api.get<VaultEntry[]>('/vault/entries', { page, limit })
      if (res.data) allEntries.push(...res.data)
      if (!res.pagination || page >= res.pagination.totalPages) break
      page++
    }

    const batchItems = []
    for (const entry of allEntries) {
      const decrypted = await decrypt(entry.encrypted_data, oldPassword, salt)
      const newEncrypted = await encrypt(decrypted, newPassword, salt)
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
    vaultSalt,
    fetchVaultSalt,
    initVaultSalt,
    ensureSalt,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    fetchEntries,
    fetchEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    decryptEntry,
    reEncryptAll,
    generatePassword,
    setPage,
  }
})
