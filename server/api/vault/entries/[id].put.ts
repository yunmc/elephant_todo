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
  await VaultModel.updateEntry(id, userId, body)
  const entry = await VaultModel.findEntryById(id, userId)
  return { success: true, data: entry }
})
