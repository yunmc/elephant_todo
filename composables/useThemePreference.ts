type ThemePreference = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'

const THEME_KEY = 'elephant-theme'

function normalizeTheme(value: string | null): ThemePreference | null {
  if (value === 'system' || value === 'light' || value === 'dark') return value
  return null
}

export function useThemePreference() {
  const preference = useState<ThemePreference>('theme-preference', () => 'system')
  const initialized = useState<boolean>('theme-preference-initialized', () => false)
  const mediaBound = useState<boolean>('theme-preference-media-bound', () => false)
  const watcherBound = useState<boolean>('theme-preference-watcher-bound', () => false)

  const { colorMode, colorModePreference, colorModeForced } = useNaiveColorMode()

  function resolveTheme(mode: ThemePreference): ResolvedTheme {
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return mode
  }

  function applyRootTheme(resolved: ResolvedTheme) {
    if (!import.meta.client) return
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.setAttribute('data-theme', resolved)
    root.setAttribute('data-app-theme', resolved)
  }

  /**
   * Watch NaiveUI's colorMode so our CSS vars always stay in sync,
   * even when NaiveUI's own plugin resets colorModeForced or re-syncs
   * (e.g. after same-route navigation, page:loading:end, visibilitychange).
   */
  function bindColorModeWatcher() {
    if (!import.meta.client || watcherBound.value) return
    watch(colorMode, (mode) => {
      if (mode === 'dark' || mode === 'light') {
        applyRootTheme(mode)
      }
    })
    watcherBound.value = true
  }

  function setPreference(mode: ThemePreference, persist = true) {
    preference.value = mode

    const resolved = resolveTheme(mode)
    applyRootTheme(resolved)

    // Let NaiveUI manage its own state via the cookie preference.
    // Don't force colorModeForced — NaiveUI's router.afterEach resets it
    // on every navigation, causing fights. Instead rely on the cookie.
    colorModePreference.set(mode)
    colorMode.value = resolved

    if (persist) {
      localStorage.setItem(THEME_KEY, mode)
    }
  }

  function initialize() {
    if (!import.meta.client || initialized.value) return

    const saved = normalizeTheme(localStorage.getItem(THEME_KEY))
    setPreference(saved || preference.value || 'system', false)
    initialized.value = true

    bindColorModeWatcher()

    if (!mediaBound.value) {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      media.addEventListener('change', () => {
        if (preference.value === 'system') {
          setPreference('system', false)
        }
      })
      mediaBound.value = true
    }
  }

  return {
    preference,
    initialize,
    setPreference,
  }
}
