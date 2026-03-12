export default defineNuxtPlugin(() => {
  const authStore = useAuthStore()
  const POLL_INTERVAL = 5 * 60 * 1000 // 5 分钟
  let timer: ReturnType<typeof setInterval> | null = null

  const start = () => {
    if (timer) return
    timer = setInterval(() => {
      if (authStore.user) authStore.fetchMe().catch(() => {})
    }, POLL_INTERVAL)
  }

  const stop = () => {
    if (timer) { clearInterval(timer); timer = null }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (authStore.user) authStore.fetchMe().catch(() => {})
      start()
    } else {
      stop()
    }
  })

  // 应用启动时立即刷新一次用户数据（确保 cookie 中的会员状态是最新的）
  if (authStore.user) {
    authStore.fetchMe().catch(() => {})
  }

  // 登录后开始轮询
  watch(() => authStore.user, (user) => {
    user ? start() : stop()
  }, { immediate: true })
})
