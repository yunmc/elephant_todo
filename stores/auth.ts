import { defineStore } from 'pinia'
import type { User, AuthTokens } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)

  // Use cookies for SSR-compatible token storage
  const accessTokenCookie = useCookie('accessToken', { maxAge: 60 * 60 * 24 * 7 })
  const refreshTokenCookie = useCookie('refreshToken', { maxAge: 60 * 60 * 24 * 30 })
  const userCookie = useCookie<User | null>('user', { maxAge: 60 * 60 * 24 * 7 })

  const accessToken = computed(() => accessTokenCookie.value || null)
  const refreshToken = computed(() => refreshTokenCookie.value || null)
  const isLoggedIn = computed(() => !!accessTokenCookie.value)

  // Restore user from cookie (spread to ensure proper prototype — fixes Pinia serialization)
  if (userCookie.value) {
    user.value = { ...userCookie.value }
  }

  function saveTokens(tokens: AuthTokens) {
    accessTokenCookie.value = tokens.accessToken
    refreshTokenCookie.value = tokens.refreshToken
  }

  function saveUser(u: User) {
    user.value = { ...u }
    userCookie.value = { ...u }
  }

  async function login(email: string, password: string): Promise<{ success: boolean; message?: string }> {
    loading.value = true
    try {
      const res = await $fetch<any>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      saveTokens({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
      })
      saveUser(res.data.user)
      return { success: true }
    } catch (err: any) {
      const message = err?.data?.message || '登录失败'
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  async function register(username: string, email: string, password: string): Promise<{ success: boolean; message?: string }> {
    loading.value = true
    try {
      const res = await $fetch<any>('/api/auth/register', {
        method: 'POST',
        body: { username, email, password },
      })
      saveTokens({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
      })
      saveUser(res.data.user)
      return { success: true }
    } catch (err: any) {
      const message = err?.data?.message || '注册失败'
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  async function refresh(): Promise<boolean> {
    if (!refreshTokenCookie.value) return false
    try {
      const res = await $fetch<any>('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken: refreshTokenCookie.value },
      })
      saveTokens({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
      })
      return true
    } catch {
      logout()
      return false
    }
  }

  async function fetchMe() {
    if (!accessTokenCookie.value) return
    try {
      const api = useApi()
      const res = await api.get('/auth/me')
      saveUser(res.data)
    } catch {
      // Token invalid — useApi will attempt refresh automatically
    }
  }

  function logout() {
    user.value = null
    accessTokenCookie.value = null
    refreshTokenCookie.value = null
    userCookie.value = null
  }

  return {
    user,
    accessToken,
    refreshToken,
    loading,
    isLoggedIn,
    login,
    register,
    refresh,
    fetchMe,
    logout,
    saveUser,
  }
})
