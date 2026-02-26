import type { CreateVaultGroupDTO } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<CreateVaultGroupDTO>(event)

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    throw createError({ statusCode: 400, message: '分组名称不能为空' })
  }
  if (name.length > 50) {
    throw createError({ statusCode: 400, message: '分组名称不能超过50个字符' })
  }

  const id = await VaultModel.createGroup(userId, {
    name,
    icon: body.icon || undefined,
    sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
  })
  const group = await VaultModel.findGroupById(id, userId)
  setResponseStatus(event, 201)
  return { success: true, data: group }
})
