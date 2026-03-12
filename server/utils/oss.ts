import OSS from 'ali-oss'
import crypto from 'crypto'

let _client: OSS | null = null

export function getOssClient(): OSS {
  if (!_client) {
    const config = useRuntimeConfig()
    if (!config.aliyunOssBucket || !config.aliyunOssAccessKeyId) {
      throw createError({ statusCode: 500, message: 'OSS 未配置' })
    }
    _client = new OSS({
      region: config.aliyunOssRegion as string,
      bucket: config.aliyunOssBucket as string,
      accessKeyId: config.aliyunOssAccessKeyId as string,
      accessKeySecret: config.aliyunOssAccessKeySecret as string,
    })
  }
  return _client
}

// ==================== OSS Key 生成 ====================
// 所有路径规范见 /memories/repo/oss-convention.md

function randHex() {
  return crypto.randomBytes(8).toString('hex')
}

function extOf(filename: string): string {
  const idx = filename.lastIndexOf('.')
  if (idx <= 0) return 'jpg'
  return filename.slice(idx + 1).toLowerCase() || 'jpg'
}

/** 用户记录附件: attachments/{userId}/{YYYYMMDD}/{rand}.{ext} */
export function ossKeyAttachment(userId: number, filename: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `attachments/${userId}/${date}/${randHex()}.${extOf(filename)}`
}

/** 商品预览图: products/{type}/{productId}_{rand}.{ext} */
export function ossKeyProduct(productType: string, productId: number, filename: string): string {
  return `products/${productType}/${productId}_${randHex()}.${extOf(filename)}`
}

/** 宠物精灵图: pets/sprites/{skinId}/{state}.png */
export function ossKeyPetSprite(skinId: string, state: string): string {
  return `pets/sprites/${skinId}/${state}.png`
}

/** 贴纸包素材: stickers/{packId}/{name}.png */
export function ossKeySticker(packId: number, name: string): string {
  return `stickers/${packId}/${name}.png`
}

/** 字体文件: fonts/{fontId}_{name}.{ext} */
export function ossKeyFont(fontId: number, name: string, filename: string): string {
  return `fonts/${fontId}_${name}.${extOf(filename)}`
}

/** @deprecated 使用 ossKeyAttachment 代替 */
export function generateOssKey(userId: number, originalFilename: string): string {
  return ossKeyAttachment(userId, originalFilename)
}

// ==================== 文件校验 ====================

const MIME_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MIME_FONT = ['font/woff2', 'font/ttf', 'application/octet-stream']

const LIMITS: Record<string, { mime: string[]; maxSize: number; label: string }> = {
  attachment: { mime: MIME_IMAGE, maxSize: 5 * 1024 * 1024, label: '附件图片' },
  product:    { mime: MIME_IMAGE, maxSize: 2 * 1024 * 1024, label: '商品预览图' },
  pet:        { mime: ['image/png'], maxSize: 1 * 1024 * 1024, label: '宠物精灵图' },
  sticker:    { mime: ['image/png', 'image/webp'], maxSize: 512 * 1024, label: '贴纸' },
  font:       { mime: MIME_FONT, maxSize: 5 * 1024 * 1024, label: '字体文件' },
}

/** 校验上传文件（按分类） */
export function validateUploadFile(mimeType: string, size: number, category: keyof typeof LIMITS = 'attachment') {
  const rule = LIMITS[category]
  if (!rule.mime.includes(mimeType)) {
    throw createError({ statusCode: 400, message: `${rule.label}仅支持 ${rule.mime.join('/')} 格式` })
  }
  if (size > rule.maxSize) {
    const mb = (rule.maxSize / 1024 / 1024).toFixed(0)
    const kb = (rule.maxSize / 1024).toFixed(0)
    const display = rule.maxSize >= 1024 * 1024 ? `${mb}MB` : `${kb}KB`
    throw createError({ statusCode: 400, message: `${rule.label}大小不能超过 ${display}` })
  }
}

/** 上传 Buffer 到 OSS，返回协议相对 URL（自动跟随页面协议） */
export async function uploadToOss(key: string, buffer: Buffer, mimeType: string): Promise<string> {
  const client = getOssClient()
  const result = await client.put(key, buffer, {
    headers: { 'Content-Type': mimeType },
  })
  // ali-oss 返回 http://xxx，转为协议相对 //xxx，自动匹配当前页面协议
  return result.url.replace(/^https?:\/\//, '//')
}

/** 从 OSS 删除文件 */
export async function deleteFromOss(key: string): Promise<void> {
  const client = getOssClient()
  await client.delete(key)
}
