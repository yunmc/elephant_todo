import type { ApiResponse } from '~/types'

/**
 * Composable for making API calls with auth token handling and automatic refresh.
 * In a fullstack Nuxt app, API routes are on the same origin (/api/...).
 */
export function useApi() {
  const authStore = useAuthStore()

  async function request<T = any>(
    url: string,
    options: { method?: string; body?: any; params?: Record<string, any> } = {},
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {}

    // Attach auth token
    if (authStore.accessToken) {
      headers['Authorization'] = `Bearer ${authStore.accessToken}`
    }

    // Build query string for params
    let fullUrl = `/api${url}`
    if (options.params) {
      const searchParams = new URLSearchParams()
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value))
        }
      })
      const qs = searchParams.toString()
      if (qs) fullUrl += `?${qs}`
    }

    try {
      const response = await $fetch<ApiResponse<T>>(fullUrl, {
        method: (options.method || 'GET') as any,
        headers,
        body: options.body,
      })
      return response
    } catch (error: any) {
      // If 401, try to refresh token
      if (error?.response?.status === 401 && authStore.refreshToken && !url.includes('/auth/refresh')) {
        const refreshed = await authStore.refresh()
        if (refreshed) {
          // Retry original request with new token
          headers['Authorization'] = `Bearer ${authStore.accessToken}`
          const retryResponse = await $fetch<ApiResponse<T>>(fullUrl, {
            method: (options.method || 'GET') as any,
            headers,
            body: options.body,
          })
          return retryResponse
        } else {
          authStore.logout()
          navigateTo('/login')
          throw error
        }
      }
      throw error
    }
  }

  return {
    get: <T = any>(url: string, params?: Record<string, any>) =>
      request<T>(url, { method: 'GET', params }),

    post: <T = any>(url: string, body?: any) =>
      request<T>(url, { method: 'POST', body }),

    put: <T = any>(url: string, body?: any) =>
      request<T>(url, { method: 'PUT', body }),

    patch: <T = any>(url: string, body?: any) =>
      request<T>(url, { method: 'PATCH', body }),

    delete: <T = any>(url: string) =>
      request<T>(url, { method: 'DELETE' }),
  }
}
