export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()
  const { loadAppearance, applyToDOM } = useAppearance()

  watch(() => authStore.user, (user) => {
    if (!user) {
      // 登出：清除皮肤 + localStorage
      applyToDOM(null)
      localStorage.removeItem('elephant-skin')
      return
    }
    loadAppearance()
  }, { immediate: true })
})
