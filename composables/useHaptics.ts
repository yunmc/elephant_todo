// composables/useHaptics.ts
import { Capacitor } from '@capacitor/core'

export function useHaptics() {
  const isNative = Capacitor.isNativePlatform()

  async function impact(style: 'light' | 'medium' | 'heavy' = 'medium') {
    if (!isNative) return
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const styleMap = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    }
    await Haptics.impact({ style: styleMap[style] })
  }

  async function notification(type: 'success' | 'warning' | 'error' = 'success') {
    if (!isNative) return
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    const typeMap = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    }
    await Haptics.notification({ type: typeMap[type] })
  }

  return { impact, notification, isNative }
}
