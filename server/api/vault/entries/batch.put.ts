import type { VaultEntryBatchUpdateItem } from '~~/server/types'

const MAX_BATCH_SIZE = 500

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<{ entries: VaultEntryBatchUpdateItem[] }>(event)

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    throw createError({ statusCode: 400, message: '请提供要更新的条目列表' })
  }
  if (body.entries.length > MAX_BATCH_SIZE) {
    throw createError({ statusCode: 400, message: `批量更新不能超过${MAX_BATCH_SIZE}条` })
  }
  // Validate each item
  for (const item of body.entries) {
    if (typeof item.id !== 'number' || !Number.isInteger(item.id) || item.id <= 0) {
      throw createError({ statusCode: 400, message: '无效的条目 ID' })
    }
    if (typeof item.encrypted_data !== 'string' || !item.encrypted_data) {
      throw createError({ statusCode: 400, message: '加密数据不能为空' })
    }
  }

  await VaultModel.batchUpdateEntries(userId, body.entries)
  return { success: true, message: '批量更新成功' }
})
