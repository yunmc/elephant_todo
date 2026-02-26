import type { CreateVaultGroupDTO } from '~~/server/types'

export default defineEventHandler(async (event) => {
  const userId = requireAuth(event)
  const body = await readBody<CreateVaultGroupDTO>(event)

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: '分组名称不能为空' })
  }

  const id = await VaultModel.createGroup(userId, body)
  const group = await VaultModel.findGroupById(id, userId)
  setResponseStatus(event, 201)
  return { success: true, data: group }
})
