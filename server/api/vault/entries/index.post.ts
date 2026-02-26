import type { CreateVaultEntryDTO } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<CreateVaultEntryDTO>(event)

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '条目名称不能为空' })
  }
  if (!body.encrypted_data) {
    throw createError({ statusCode: 400, message: '加密数据不能为空' })
  }
  if (!body.group_id) {
    throw createError({ statusCode: 400, message: '分组ID不能为空' })
  }

  // Verify group belongs to user
  const group = await VaultModel.findGroupById(body.group_id, userId)
  if (!group) {
    throw createError({ statusCode: 404, message: '分组不存在' })
  }

  const id = await VaultModel.createEntry(userId, body)
  const entry = await VaultModel.findEntryById(id, userId)
  setResponseStatus(event, 201)
  return { success: true, data: entry }
})
