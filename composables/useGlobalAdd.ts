/**
 * Global "+" button context-aware action system.
 *
 * - Layout calls `provideGlobalAdd()` to set up the provider.
 * - Pages call `useGlobalAdd(handler)` to register a page-specific action.
 * - When no page handler is registered, the layout falls back to the default quick-add modal.
 */

const GLOBAL_ADD_KEY = Symbol('globalAdd') as InjectionKey<{
  register: (handler: () => void) => void
  unregister: () => void
  invoke: () => boolean
}>

/**
 * Call in layouts/default.vue to provide the global add mechanism.
 */
export function provideGlobalAdd() {
  let pageHandler: (() => void) | null = null

  const api = {
    register(handler: () => void) {
      pageHandler = handler
    },
    unregister() {
      pageHandler = null
    },
    /** Returns true if a page handler was invoked, false otherwise */
    invoke(): boolean {
      if (pageHandler) {
        pageHandler()
        return true
      }
      return false
    },
  }

  provide(GLOBAL_ADD_KEY, api)
  return api
}

/**
 * Call in page components to register a custom "+" action.
 * Automatically unregisters on unmount.
 */
export function useGlobalAdd(handler: () => void) {
  const api = inject(GLOBAL_ADD_KEY)
  if (!api) return

  onMounted(() => api.register(handler))
  onUnmounted(() => api.unregister())
}
