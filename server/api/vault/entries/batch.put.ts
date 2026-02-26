import type { VaultEntryBatchUpdateItem } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<{ entries: VaultEntryBatchUpdateItem[] }>(event)

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    throw createError({ statusCode: 400, message: '请提供要更新的条目列表' })
  }

  await VaultModel.batchUpdateEntries(userId, body.entries)
  return { success: true, message: '批量更新成功' }
})
