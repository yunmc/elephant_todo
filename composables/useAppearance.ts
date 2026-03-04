import type { UserAppearance } from '~/types'

export function useAppearance() {
  const appearance = useState<UserAppearance | null>('appearance', () => null)

  async function loadAppearance() {
    try {
      const api = useApi()
      const res = await api.get<UserAppearance>('/user/appearance')
      appearance.value = res.data
      applyToDOM(res.data)
    } catch {
      // 未登录或无装扮
    }
  }

  function applyToDOM(config: UserAppearance | null) {
    if (!import.meta.client) return
    const root = document.documentElement
    const key = config?.skin?.asset_key
    if (key && key !== 'default') {
      root.setAttribute('data-skin', key)
      localStorage.setItem('elephant-skin', key)
    } else {
      root.removeAttribute('data-skin')
      localStorage.removeItem('elephant-skin')
    }
  }

  async function updateAppearance(config: { skin_id?: number | null; sticker_pack_id?: number | null; font_id?: number | null }) {
    const api = useApi()
    const res = await api.put<UserAppearance>('/user/appearance', config)
    appearance.value = res.data
    applyToDOM(res.data)
    return res.data
  }

  return { appearance, loadAppearance, updateAppearance, applyToDOM }
}
