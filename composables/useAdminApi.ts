/**
 * Composable for Admin API calls with automatic admin token attachment.
 */
export function useAdminApi() {
  const adminAuth = useAdminAuthStore()

  async function request<T = any>(
    url: string,
    options: { method?: string; body?: any; params?: Record<string, any> } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {}

    if (adminAuth.token) {
      headers['Authorization'] = `Bearer ${adminAuth.token}`
    }

    let fullUrl = `/api/admin${url}`
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
      const response = await $fetch<any>(fullUrl, {
        method: (options.method || 'GET') as any,
        headers,
        body: options.body,
      })
      return response.data ?? response
    } catch (error: any) {
      if (error?.response?.status === 401) {
        adminAuth.logout()
        navigateTo('/admin/login')
      }
      throw error
    }
  }

  const get = <T = any>(url: string, params?: Record<string, any>) =>
    request<T>(url, { params })

  const post = <T = any>(url: string, body?: any) =>
    request<T>(url, { method: 'POST', body })

  const put = <T = any>(url: string, body?: any) =>
    request<T>(url, { method: 'PUT', body })

  const del = <T = any>(url: string) =>
    request<T>(url, { method: 'DELETE' })

  return { request, get, post, put, del }
}
