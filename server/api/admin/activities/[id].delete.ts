
export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: '无效活动 ID' })

  await AdminActivityModel.delete(id)

  return { success: true, message: '活动已删除' }
})
