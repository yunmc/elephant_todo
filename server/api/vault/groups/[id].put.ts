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
  // Only validate name when explicitly provided
  if (body.name !== undefined && !body.name?.trim()) {
    throw createError({ statusCode: 400, message: '分组名称不能为空' })
  }
  if (body.name && body.name.length > 50) {
    throw createError({ statusCode: 400, message: '分组名称不能超过50个字符' })
  }
  const updateData: UpdateVaultGroupDTO = {}
  if (body.name !== undefined) updateData.name = body.name.trim()
  if (body.icon !== undefined) updateData.icon = body.icon
  if (body.sort_order !== undefined) updateData.sort_order = typeof body.sort_order === 'number' ? body.sort_order : 0

  await VaultModel.updateGroup(id, userId, updateData)
  const group = await VaultModel.findGroupById(id, userId)
  return { success: true, data: group }
})
