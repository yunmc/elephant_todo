import type { CreateVaultEntryDTO } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<CreateVaultEntryDTO>(event)

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, message: '条目名称不能为空' })
  }
  if (name.length > 200) {
    throw createError({ statusCode: 400, message: '条目名称不能超过200个字符' })
  }
  if (!body.encrypted_data || typeof body.encrypted_data !== 'string') {
    throw createError({ statusCode: 400, message: '加密数据不能为空' })
  }
  if (body.encrypted_data.length > 100000) {
    throw createError({ statusCode: 400, message: '加密数据过大' })
  }

  // group_id is optional (null = no group)
  const group_id = body.group_id && typeof body.group_id === 'number' && body.group_id > 0 ? body.group_id : undefined
  if (group_id) {
    const group = await VaultModel.findGroupById(group_id, userId)
    if (!group) {
      throw createError({ statusCode: 404, message: '分组不存在' })
    }
  }

  const id = await VaultModel.createEntry(userId, { name, url: body.url || undefined, group_id, encrypted_data: body.encrypted_data })
  const entry = await VaultModel.findEntryById(id, userId)
  setResponseStatus(event, 201)
  return { success: true, data: entry }
})
