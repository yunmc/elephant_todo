/**
 * Admin route guard — applied manually via definePageMeta({ middleware: 'admin' })
 * Redirects unauthenticated admins to /admin/login
 */
export default defineNuxtRouteMiddleware((to) => {
  // Skip the login page itself
  if (to.path === '/admin/login') return

  const adminAuth = useAdminAuthStore()

  if (!adminAuth.isLoggedIn) {
    return navigateTo('/admin/login')
  }
})
