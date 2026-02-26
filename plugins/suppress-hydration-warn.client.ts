/**
 * Suppress known Naive UI SSR hydration mismatch warnings in development.
 * Must use enforce: 'pre' and hook: 'app:created' to run before hydration.
 */
export default defineNuxtPlugin({
  name: 'suppress-hydration-warn',
  enforce: 'pre',
  setup(nuxtApp) {
    if (import.meta.client) {
      // Set warnHandler before hydration starts
      nuxtApp.vueApp.config.warnHandler = (msg, _instance, _trace) => {
        if (msg.includes('Hydration')) return
        console.warn(`[Vue warn]: ${msg}`)
      }
    }
  },
})
