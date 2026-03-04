import { defineStore } from 'pinia'
import type { AdminUser } from '~/types'

export const useAdminAuthStore = defineStore('adminAuth', () => {
  const admin = ref<AdminUser | null>(null)
  const loading = ref(false)

  // Use cookies for SSR-compatible token storage (separate from app user)
  const adminTokenCookie = useCookie('adminToken', { maxAge: 60 * 60 * 12 })
  const adminUserCookie = useCookie<AdminUser | null>('adminUser', { maxAge: 60 * 60 * 12 })

  const token = computed(() => adminTokenCookie.value || null)
  const isLoggedIn = computed(() => !!adminTokenCookie.value)
  const isSuperAdmin = computed(() => admin.value?.role === 'super_admin')

  // Restore from cookie
  if (adminUserCookie.value) {
    admin.value = { ...adminUserCookie.value }
  }

  async function login(username: string, password: string): Promise<{ success: boolean; message?: string }> {
    loading.value = true
    try {
      const res = await $fetch<any>('/api/admin/auth/login', {
        method: 'POST',
        body: { username, password },
      })
      adminTokenCookie.value = res.data.token
      admin.value = res.data.admin
      adminUserCookie.value = res.data.admin
      return { success: true }
    } catch (err: any) {
      return { success: false, message: err?.data?.message || '登录失败' }
    } finally {
      loading.value = false
    }
  }

  async function fetchMe(): Promise<boolean> {
    if (!adminTokenCookie.value) return false
    try {
      const res = await $fetch<any>('/api/admin/auth/me', {
        headers: { Authorization: `Bearer ${adminTokenCookie.value}` },
      })
      admin.value = res.data
      adminUserCookie.value = res.data
      return true
    } catch {
      logout()
      return false
    }
  }

  function logout() {
    adminTokenCookie.value = null
    adminUserCookie.value = null
    admin.value = null
  }

  return {
    admin,
    loading,
    token,
    isLoggedIn,
    isSuperAdmin,
    login,
    fetchMe,
    logout,
  }
})
