import type { UpdateVaultEntryDTO } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的条目ID' })
  }

  const existing = await VaultModel.findEntryById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '条目不存在' })
  }

  const body = await readBody<UpdateVaultEntryDTO>(event)
  const updateData: UpdateVaultEntryDTO = {}
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) throw createError({ statusCode: 400, message: '条目名称不能为空' })
    if (name.length > 200) throw createError({ statusCode: 400, message: '条目名称不能超过200个字符' })
    updateData.name = name
  }
  if (body.url !== undefined) updateData.url = body.url
  if (body.group_id !== undefined) updateData.group_id = body.group_id
  if (body.encrypted_data !== undefined) {
    if (typeof body.encrypted_data !== 'string' || body.encrypted_data.length > 100000) {
      throw createError({ statusCode: 400, message: '加密数据无效' })
    }
    updateData.encrypted_data = body.encrypted_data
  }

  await VaultModel.updateEntry(id, userId, updateData)
  const entry = await VaultModel.findEntryById(id, userId)
  return { success: true, data: entry }
})
