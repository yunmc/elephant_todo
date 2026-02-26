export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  // Public pages that don't require auth
  const publicPages = ['/login', '/register', '/forgot-password', '/reset-password']
  if (publicPages.includes(to.path)) return

  if (!authStore.isLoggedIn) {
    return navigateTo('/login')
  }
})
