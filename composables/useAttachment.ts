import type { Attachment } from '~/types'

type TargetType = 'finance_record' | 'idea' | 'todo'

export function useAttachment() {
  const authStore = useAuthStore()

  function getHeaders() {
    const headers: Record<string, string> = {}
    if (authStore.accessToken) {
      headers['Authorization'] = `Bearer ${authStore.accessToken}`
    }
    return headers
  }

  /** 上传附件（自动压缩图片到 1080px 宽度） */
  async function upload(file: File, targetType: TargetType, targetId: number): Promise<Attachment> {
    const compressed = await compressImage(file)

    const formData = new FormData()
    formData.append('file', compressed, file.name)
    formData.append('target_type', targetType)
    formData.append('target_id', String(targetId))

    const res = await $fetch<{ success: boolean; data: Attachment }>('/api/attachments/upload', {
      method: 'POST',
      headers: getHeaders(),
      body: formData,
      timeout: 60000,
    })
    return res.data
  }

  /** 查询目标的附件列表 */
  async function list(targetType: TargetType, targetId: number): Promise<Attachment[]> {
    const res = await $fetch<{ success: boolean; data: Attachment[] }>('/api/attachments', {
      headers: getHeaders(),
      params: { target_type: targetType, target_id: targetId },
    })
    return res.data
  }

  /** 删除附件 */
  async function remove(id: number): Promise<void> {
    await $fetch(`/api/attachments/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
  }

  return { upload, list, remove }
}

/** 客户端图片压缩：最大宽度 1080px，quality 0.8 */
function compressImage(file: File, maxWidth = 1080, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    // 非图片或 GIF 不压缩
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      resolve(file)
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // 不需要压缩
      if (img.width <= maxWidth && file.size <= 2 * 1024 * 1024) {
        resolve(file)
        return
      }

      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file) // fallback
            return
          }
          resolve(new File([blob], file.name, { type: file.type === 'image/png' ? 'image/png' : 'image/jpeg' }))
        },
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }

    img.src = url
  })
}
