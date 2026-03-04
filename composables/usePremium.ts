export function usePremium() {
  const authStore = useAuthStore()

  const isPremium = computed(() => {
    const user = authStore.user
    if (!user) return false
    if (user.plan !== 'premium') return false
    if (!user.plan_expires_at) return false
    const now = new Date()
    const expiresAt = new Date(user.plan_expires_at)
    const notExpired = expiresAt > now
    // auto_renew=1 时给宽限期（Apple billing retry 最多 60 天），上限 65 天
    const MAX_GRACE_PERIOD_MS = 65 * 24 * 60 * 60 * 1000
    const withinGrace = user.auto_renew
      && (now.getTime() - expiresAt.getTime()) < MAX_GRACE_PERIOD_MS
    return notExpired || withinGrace
  })

  const isExpired = computed(() => {
    const user = authStore.user
    if (!user) return false
    if (user.plan !== 'premium' || !user.plan_expires_at) return false
    const now = new Date()
    const expiresAt = new Date(user.plan_expires_at)
    if (expiresAt > now) return false
    // auto_renew 宽限期内不算过期
    const MAX_GRACE_PERIOD_MS = 65 * 24 * 60 * 60 * 1000
    const withinGrace = user.auto_renew
      && (now.getTime() - expiresAt.getTime()) < MAX_GRACE_PERIOD_MS
    return !withinGrace
  })

  const isAutoRenew = computed(() => {
    return authStore.user?.auto_renew ?? false
  })

  const daysRemaining = computed(() => {
    const user = authStore.user
    if (!isPremium.value || !user?.plan_expires_at) return 0
    const diff = new Date(user.plan_expires_at).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })

  // 显示升级弹窗的全局状态
  const showUpgradeModal = useState('show-upgrade-modal', () => false)
  const upgradeModalExpired = useState('upgrade-modal-expired', () => false)

  /** 检查是否 Premium，非会员弹出升级引导，返回 false */
  function guardPremium(): boolean {
    if (isPremium.value) return true
    upgradeModalExpired.value = isExpired.value
    showUpgradeModal.value = true
    return false
  }

  return {
    isPremium,
    isExpired,
    isAutoRenew,
    daysRemaining,
    showUpgradeModal,
    upgradeModalExpired,
    guardPremium,
  }
}
