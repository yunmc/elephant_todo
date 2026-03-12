/**
 * OSS 工具函数 — Unit + Integration Tests
 *
 * Part 1: 纯函数测试（ossKey 生成、validateUploadFile）— 无外部依赖
 * Part 2: 读写集成测试（真实 OSS 上传/下载/删除）— 需要 .env 中的 OSS 配置
 *         默认跳过，设置 RUN_OSS_INTEGRATION=1 开启
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ossKeyAttachment,
  ossKeyProduct,
  ossKeyPetSprite,
  ossKeySticker,
  ossKeyFont,
  generateOssKey,
  validateUploadFile,
} from '../../server/utils/oss'

// ================================================================
// Part 1: 纯函数测试
// ================================================================

describe('OSS Key Generation', () => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  describe('ossKeyAttachment', () => {
    it('should generate correct path pattern', () => {
      const key = ossKeyAttachment(42, 'photo.jpg')
      expect(key).toMatch(new RegExp(`^attachments/42/${today}/[a-f0-9]{16}\\.jpg$`))
    })

    it('should use lowercase extension', () => {
      const key = ossKeyAttachment(1, 'IMG.PNG')
      expect(key).toMatch(/\.png$/)
    })

    it('should default to jpg when no extension', () => {
      const key = ossKeyAttachment(1, 'noext')
      expect(key).toMatch(/\.jpg$/)
    })

    it('should generate unique keys for same input', () => {
      const key1 = ossKeyAttachment(1, 'a.jpg')
      const key2 = ossKeyAttachment(1, 'a.jpg')
      expect(key1).not.toBe(key2)
    })
  })

  describe('ossKeyProduct', () => {
    it('should generate correct path pattern', () => {
      const key = ossKeyProduct('skin', 15, 'preview.png')
      expect(key).toMatch(/^products\/skin\/15_[a-f0-9]{16}\.png$/)
    })

    it('should handle different product types', () => {
      expect(ossKeyProduct('font', 3, 'f.webp')).toMatch(/^products\/font\/3_/)
      expect(ossKeyProduct('pet_skin', 7, 'p.jpg')).toMatch(/^products\/pet_skin\/7_/)
    })
  })

  describe('ossKeyPetSprite', () => {
    it('should generate deterministic path', () => {
      const key = ossKeyPetSprite('pink-heart', 'happy')
      expect(key).toBe('pets/sprites/pink-heart/happy.png')
    })
  })

  describe('ossKeySticker', () => {
    it('should generate deterministic path', () => {
      const key = ossKeySticker(3, 'star')
      expect(key).toBe('stickers/3/star.png')
    })
  })

  describe('ossKeyFont', () => {
    it('should generate correct path', () => {
      const key = ossKeyFont(7, 'cute-handwriting', 'font.woff2')
      expect(key).toBe('fonts/7_cute-handwriting.woff2')
    })

    it('should extract extension from filename', () => {
      const key = ossKeyFont(1, 'bold', 'MyFont.TTF')
      expect(key).toBe('fonts/1_bold.ttf')
    })
  })

  describe('generateOssKey (deprecated)', () => {
    it('should delegate to ossKeyAttachment', () => {
      const key = generateOssKey(42, 'test.png')
      expect(key).toMatch(new RegExp(`^attachments/42/${today}/[a-f0-9]{16}\\.png$`))
    })
  })
})

describe('validateUploadFile', () => {
  describe('attachment category (default)', () => {
    it('should accept valid image types', () => {
      expect(() => validateUploadFile('image/jpeg', 1024)).not.toThrow()
      expect(() => validateUploadFile('image/png', 1024)).not.toThrow()
      expect(() => validateUploadFile('image/gif', 1024)).not.toThrow()
      expect(() => validateUploadFile('image/webp', 1024)).not.toThrow()
    })

    it('should reject invalid MIME type', () => {
      expect(() => validateUploadFile('application/pdf', 1024)).toThrow('仅支持')
      expect(() => validateUploadFile('text/plain', 1024)).toThrow('仅支持')
    })

    it('should reject file exceeding 5MB', () => {
      const size = 5 * 1024 * 1024 + 1
      expect(() => validateUploadFile('image/jpeg', size)).toThrow('5MB')
    })

    it('should accept file exactly at 5MB', () => {
      const size = 5 * 1024 * 1024
      expect(() => validateUploadFile('image/jpeg', size)).not.toThrow()
    })
  })

  describe('product category', () => {
    it('should reject file exceeding 2MB', () => {
      const size = 2 * 1024 * 1024 + 1
      expect(() => validateUploadFile('image/png', size, 'product')).toThrow('2MB')
    })

    it('should accept valid product image', () => {
      expect(() => validateUploadFile('image/png', 1024, 'product')).not.toThrow()
    })
  })

  describe('pet category', () => {
    it('should only accept PNG', () => {
      expect(() => validateUploadFile('image/png', 1024, 'pet')).not.toThrow()
      expect(() => validateUploadFile('image/jpeg', 1024, 'pet')).toThrow('仅支持')
    })

    it('should reject file exceeding 1MB', () => {
      const size = 1 * 1024 * 1024 + 1
      expect(() => validateUploadFile('image/png', size, 'pet')).toThrow('1MB')
    })
  })

  describe('sticker category', () => {
    it('should accept PNG and WebP', () => {
      expect(() => validateUploadFile('image/png', 1024, 'sticker')).not.toThrow()
      expect(() => validateUploadFile('image/webp', 1024, 'sticker')).not.toThrow()
    })

    it('should reject file exceeding 500KB', () => {
      const size = 512 * 1024 + 1
      expect(() => validateUploadFile('image/png', size, 'sticker')).toThrow('512KB')
    })
  })

  describe('font category', () => {
    it('should accept font MIME types', () => {
      expect(() => validateUploadFile('font/woff2', 1024, 'font')).not.toThrow()
      expect(() => validateUploadFile('font/ttf', 1024, 'font')).not.toThrow()
      expect(() => validateUploadFile('application/octet-stream', 1024, 'font')).not.toThrow()
    })

    it('should reject image as font', () => {
      expect(() => validateUploadFile('image/png', 1024, 'font')).toThrow('仅支持')
    })

    it('should reject file exceeding 5MB', () => {
      const size = 5 * 1024 * 1024 + 1
      expect(() => validateUploadFile('font/woff2', size, 'font')).toThrow('5MB')
    })
  })
})

// ================================================================
// Part 2: OSS 读写集成测试
// ================================================================
// 运行方式: RUN_OSS_INTEGRATION=1 npx vitest run tests/unit/oss.test.ts

const runIntegration = process.env.RUN_OSS_INTEGRATION === '1'

describe.skipIf(!runIntegration)('OSS Integration (read/write)', () => {
  // 集成测试需要真实 OSS 配置
  // 先 stub useRuntimeConfig 为真实值
  let uploadToOss: typeof import('../../server/utils/oss').uploadToOss
  let deleteFromOss: typeof import('../../server/utils/oss').deleteFromOss
  let getOssClient: typeof import('../../server/utils/oss').getOssClient

  beforeEach(async () => {
    // 每次重新加载以拿到真实 config
    // 需要先设置 runtimeConfig 返回真实 OSS 配置
    const dotenv = await import('dotenv')
    dotenv.config({ path: '.env' })

    vi.stubGlobal('useRuntimeConfig', () => ({
      aliyunOssRegion: process.env.ALIYUN_OSS_REGION || 'oss-cn-beijing',
      aliyunOssBucket: process.env.ALIYUN_OSS_BUCKET || 'elephant-todo',
      aliyunOssAccessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
      aliyunOssAccessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
    }))

    // 重新导入获取新实例
    vi.resetModules()
    const mod = await import('../../server/utils/oss')
    uploadToOss = mod.uploadToOss
    deleteFromOss = mod.deleteFromOss
    getOssClient = mod.getOssClient
  })

  it('should upload, read, and delete a test file', async () => {
    const testKey = `_test/integration_${Date.now()}.txt`
    const testContent = Buffer.from('elephant-todo OSS integration test')

    // 1. 上传
    const url = await uploadToOss(testKey, testContent, 'text/plain')
    expect(url).toContain(testKey)
    console.log('  ✅ Upload OK:', url)

    // 2. 通过 HTTP 读取验证
    const response = await fetch(url)
    expect(response.ok).toBe(true)
    const body = await response.text()
    expect(body).toBe('elephant-todo OSS integration test')
    console.log('  ✅ Read OK: content matches')

    // 3. 删除
    await deleteFromOss(testKey)
    console.log('  ✅ Delete OK')

    // 4. 验证删除后 404
    const afterDelete = await fetch(url)
    expect(afterDelete.ok).toBe(false)
    console.log('  ✅ Verify deleted: got', afterDelete.status)
  })

  it('should upload and delete an image file', async () => {
    // 创建 1x1 红色 PNG
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
    ])

    const testKey = `_test/integration_${Date.now()}.png`
    const url = await uploadToOss(testKey, pngHeader, 'image/png')
    expect(url).toContain('.png')
    console.log('  ✅ Image upload OK:', url)

    // 验证 Content-Type
    const response = await fetch(url, { method: 'HEAD' })
    expect(response.headers.get('content-type')).toContain('image/png')
    console.log('  ✅ Content-Type:', response.headers.get('content-type'))

    // 清理
    await deleteFromOss(testKey)
    console.log('  ✅ Cleanup OK')
  })
})
