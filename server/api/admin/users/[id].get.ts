
export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: '无效用户 ID' })

  const user = await AdminUserMgmtModel.detail(id)
  if (!user) throw createError({ statusCode: 404, message: '用户不存在' })

  return { success: true, data: user }
})
