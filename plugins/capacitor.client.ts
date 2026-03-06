// plugins/capacitor.client.ts
import { Capacitor } from '@capacitor/core'

export default defineNuxtPlugin(async () => {
  if (!Capacitor.isNativePlatform()) return

  // 添加平台 class
  document.documentElement.classList.add('capacitor-native')
  if (Capacitor.getPlatform() === 'ios') {
    document.documentElement.classList.add('capacitor-ios')
  }

  // --- 状态栏 ---
  const { StatusBar, Style } = await import('@capacitor/status-bar')
  const isDark = document.documentElement.classList.contains('dark')
  await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })

  const observer = new MutationObserver(() => {
    const dark = document.documentElement.classList.contains('dark')
    StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  // --- 键盘 ---
  const { Keyboard } = await import('@capacitor/keyboard')
  Keyboard.addListener('keyboardWillShow', (info) => {
    document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`)
  })
  Keyboard.addListener('keyboardWillHide', () => {
    document.documentElement.style.setProperty('--keyboard-height', '0px')
  })

  // --- 启动屏 ---
  const { SplashScreen } = await import('@capacitor/splash-screen')
  await SplashScreen.hide()
})
