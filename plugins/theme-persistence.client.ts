export default defineNuxtPlugin((nuxtApp) => {
  const { initialize, setPreference, preference } = useThemePreference()

  function normalizeTheme(value: string | null): 'system' | 'light' | 'dark' | null {
    if (value === 'system' || value === 'light' || value === 'dark') return value
    return null
  }

  /**
   * Also write the NaiveUI cookie without `secure` flag so it works on HTTP
   * (NaiveUI sets secure:true which is silently dropped on non-HTTPS).
   */
  function ensureNaiveCookie(mode: 'system' | 'light' | 'dark') {
    const name = 'naive_color_mode_preference'
    document.cookie = `${name}=${mode};path=/;max-age=${356 * 86400};samesite=lax`
  }

  function syncThemeFromStorage() {
    if (!import.meta.client) return
    const saved = normalizeTheme(localStorage.getItem('elephant-theme'))
    const mode = saved || preference.value || 'system'
    setPreference(mode, false)
    ensureNaiveCookie(mode)
  }

  nuxtApp.hook('app:mounted', () => {
    initialize()
    syncThemeFromStorage()
  })

  nuxtApp.hook('page:finish', () => {
    syncThemeFromStorage()
  })

  // Re-apply after every navigation (including same-route clicks).
  // Use nextTick so this runs AFTER NaiveUI's own afterEach resets colorModeForced.
  const router = useRouter()
  router.afterEach(() => {
    nextTick(() => {
      syncThemeFromStorage()
    })
  })
})
