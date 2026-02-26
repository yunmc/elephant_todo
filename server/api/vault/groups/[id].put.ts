import type { UpdateVaultGroupDTO } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的分组ID' })
  }

  const existing = await VaultModel.findGroupById(id, userId)
  if (!existing) {
    throw createError({ statusCode: 404, message: '分组不存在' })
  }

  const body = await readBody<UpdateVaultGroupDTO>(event)
  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '分组名称不能为空' })
  }

  await VaultModel.updateGroup(id, userId, body)
  const group = await VaultModel.findGroupById(id, userId)
  return { success: true, data: group }
})
