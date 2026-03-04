import { AdminActivityModel } from '~~/server/utils/models/admin.model'

export default defineEventHandler(async (event) => {
  requireAdminAuth(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: '无效活动 ID' })

  const body = await readBody(event)

  await AdminActivityModel.update(id, {
    title: body.title,
    type: body.type,
    description: body.description,
    config: body.config,
    starts_at: body.starts_at,
    ends_at: body.ends_at,
    status: body.status,
  })

  return { success: true, message: '活动已更新' }
})
